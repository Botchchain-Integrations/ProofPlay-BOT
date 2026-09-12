"use client";

import { useMemo } from "react";
import type { Room } from "@proofplay/shared";
import { formatEther, type Address } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { contractAddresses, fantasyMatchRoomAbi, hasConfiguredAddress, matchRoomFactoryAbi } from "@/lib/contracts";
import { getMatchLabel } from "@/lib/demo-data";
import { RoomCard } from "@/components/RoomCard";

function getReadBigInt(value: unknown) {
  return typeof value === "bigint" ? value : 0n;
}

function getReadBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function toIsoDeadline(unixSeconds: bigint) {
  const numeric = Number(unixSeconds);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return new Date(0).toISOString();
  }

  return new Date(numeric * 1000).toISOString();
}

export function OnChainRoomsList() {
  const canReadFactory = hasConfiguredAddress(contractAddresses.factory);

  const roomsQuery = useReadContract({
    abi: matchRoomFactoryAbi,
    address: contractAddresses.factory,
    functionName: "getRooms",
    query: {
      enabled: canReadFactory
    }
  });

  const roomAddresses = useMemo(() => {
    return (roomsQuery.data ?? []) as Address[];
  }, [roomsQuery.data]);

  const roomMetadataContracts = useMemo(() => {
    return roomAddresses.flatMap((address) => [
      {
        abi: fantasyMatchRoomAbi,
        address,
        functionName: "entryFee" as const
      },
      {
        abi: fantasyMatchRoomAbi,
        address,
        functionName: "maxParticipants" as const
      },
      {
        abi: fantasyMatchRoomAbi,
        address,
        functionName: "lineupDeadline" as const
      },
      {
        abi: fantasyMatchRoomAbi,
        address,
        functionName: "locked" as const
      },
      {
        abi: fantasyMatchRoomAbi,
        address,
        functionName: "settled" as const
      }
    ]);
  }, [roomAddresses]);

  const roomMetadataQuery = useReadContracts({
    contracts: roomMetadataContracts,
    query: {
      enabled: roomMetadataContracts.length > 0
    }
  });

  const rooms = useMemo<Room[]>(() => {
    return roomAddresses.map((address, index) => {
      const base = index * 5;
      const entryFee = getReadBigInt(roomMetadataQuery.data?.[base]?.result);
      const maxParticipants = getReadBigInt(roomMetadataQuery.data?.[base + 1]?.result);
      const lineupDeadline = getReadBigInt(roomMetadataQuery.data?.[base + 2]?.result);
      const locked = getReadBoolean(roomMetadataQuery.data?.[base + 3]?.result);
      const settled = getReadBoolean(roomMetadataQuery.data?.[base + 4]?.result);
      const status = settled ? "settled" : locked ? "locked" : "open";

      return {
        id: address,
        matchId: address,
        entryFee: formatEther(entryFee),
        maxParticipants: Number(maxParticipants),
        deadline: toIsoDeadline(lineupDeadline),
        status
      };
    });
  }, [roomAddresses, roomMetadataQuery.data]);

  const roomLabels = useMemo(() => {
    return rooms.map((room, index) => {
      const resolved = getMatchLabel(room.matchId);
      return resolved === room.matchId ? `On-Chain Room ${index + 1}` : resolved;
    });
  }, [rooms]);

  if (!canReadFactory) {
    return (
      <div className="glass-card">
        <p className="meta">
          Factory contract address is missing. Set <code>NEXT_PUBLIC_FACTORY_ADDRESS</code> to
          load on-chain rooms.
        </p>
      </div>
    );
  }

  if (roomsQuery.isLoading || roomMetadataQuery.isLoading) {
    return (
      <div className="loading-wrap">
        <div className="spinner" />
      </div>
    );
  }

  if (roomsQuery.error) {
    return (
      <div className="glass-card">
        <p className="error-msg">Failed to read factory rooms: {roomsQuery.error.message}</p>
      </div>
    );
  }

  if (roomMetadataQuery.error) {
    return (
      <div className="glass-card">
        <p className="error-msg">Failed to read room metadata: {roomMetadataQuery.error.message}</p>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="empty-state">
        <p className="meta">No on-chain rooms found yet. Create one from the room creation page.</p>
      </div>
    );
  }

  return (
    <div className="list">
      {rooms.map((room, index) => (
        <RoomCard key={room.id} room={room} matchLabel={roomLabels[index] ?? `On-Chain Room ${index + 1}`} />
      ))}
    </div>
  );
}