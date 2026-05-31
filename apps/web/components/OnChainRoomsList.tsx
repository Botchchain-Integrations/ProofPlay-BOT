"use client";

import { useMemo } from "react";
import type { Room } from "@proofplay/shared";
import { formatEther, type Address } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { contractAddresses, fantasyMatchRoomAbi, hasConfiguredAddress, matchRoomFactoryAbi } from "@/lib/contracts";
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

function shortenAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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

  if (!canReadFactory) {
    return (
      <article className="card" style={{ marginTop: "1rem" }}>
        <p className="meta">
          Factory contract address is missing. Set <code>NEXT_PUBLIC_FACTORY_ADDRESS</code> to
          load on-chain rooms.
        </p>
      </article>
    );
  }

  if (roomsQuery.isLoading || roomMetadataQuery.isLoading) {
    return (
      <article className="card" style={{ marginTop: "1rem" }}>
        <p className="meta">Loading on-chain rooms...</p>
      </article>
    );
  }

  if (roomsQuery.error) {
    return (
      <article className="card" style={{ marginTop: "1rem" }}>
        <p className="meta" style={{ color: "#b42318" }}>
          Failed to read factory rooms: {roomsQuery.error.message}
        </p>
      </article>
    );
  }

  if (roomMetadataQuery.error) {
    return (
      <article className="card" style={{ marginTop: "1rem" }}>
        <p className="meta" style={{ color: "#b42318" }}>
          Failed to read room metadata: {roomMetadataQuery.error.message}
        </p>
      </article>
    );
  }

  if (rooms.length === 0) {
    return (
      <article className="card" style={{ marginTop: "1rem" }}>
        <p className="meta">No on-chain rooms found yet. Create one from the room creation page.</p>
      </article>
    );
  }

  return (
    <div className="list" style={{ marginTop: "1rem" }}>
      {rooms.map((room, index) => (
        <RoomCard
          key={room.id}
          room={room}
          matchLabel={`On-Chain Room ${index + 1} (${shortenAddress(room.id as Address)})`}
        />
      ))}
    </div>
  );
}
