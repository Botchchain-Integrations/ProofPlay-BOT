"use client";

import { useMemo } from "react";
import { isAddress, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { fantasyMatchRoomAbi } from "@/lib/contracts";
import { Leaderboard } from "@/components/Leaderboard";
import { ResultReceipt } from "@/components/ResultReceipt";

function shortenAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toNumberScore(value: unknown) {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return 0;
}

export function OnChainRoomResults({ roomAddress }: { roomAddress: string }) {
  const resolvedRoomAddress = useMemo(() => {
    if (isAddress(roomAddress)) {
      return roomAddress as Address;
    }

    return null;
  }, [roomAddress]);

  const roomStateQuery = useReadContracts({
    contracts: resolvedRoomAddress
      ? [
          {
            abi: fantasyMatchRoomAbi,
            address: resolvedRoomAddress,
            functionName: "settled" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: resolvedRoomAddress,
            functionName: "winner" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: resolvedRoomAddress,
            functionName: "payoutComplete" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: resolvedRoomAddress,
            functionName: "prizePool" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: resolvedRoomAddress,
            functionName: "latestReceipt" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: resolvedRoomAddress,
            functionName: "getParticipants" as const
          }
        ]
      : [],
    query: {
      enabled: Boolean(resolvedRoomAddress)
    }
  });

  const settled = roomStateQuery.data?.[0]?.result === true;
  const winner = (roomStateQuery.data?.[1]?.result as Address | undefined) ?? null;
  const payoutComplete = roomStateQuery.data?.[2]?.result === true;
  const latestReceiptText =
    typeof roomStateQuery.data?.[4]?.result === "string" ? roomStateQuery.data?.[4]?.result : "";
  const participants = ((roomStateQuery.data?.[5]?.result as Address[] | undefined) ?? []).filter((value) =>
    isAddress(value)
  );

  const scoresQuery = useReadContracts({
    contracts: participants.map((participant) => ({
      abi: fantasyMatchRoomAbi,
      address: resolvedRoomAddress as Address,
      functionName: "scores" as const,
      args: [participant]
    })),
    query: {
      enabled: Boolean(resolvedRoomAddress) && participants.length > 0
    }
  });

  const leaderboardEntries = useMemo(() => {
    return participants
      .map((participant, index) => {
        const points = toNumberScore(scoresQuery.data?.[index]?.result);
        const isWinner = winner ? winner.toLowerCase() === participant.toLowerCase() : false;

        return {
          teamName: shortenAddress(participant),
          points,
          winner: isWinner
        };
      })
      .sort((left, right) => right.points - left.points);
  }, [participants, scoresQuery.data, winner]);

  if (!resolvedRoomAddress) {
    return (
      <article className="card">
        <p className="meta" style={{ color: "#b42318" }}>
          Invalid room address route.
        </p>
      </article>
    );
  }

  if (roomStateQuery.isLoading || scoresQuery.isLoading) {
    return (
      <article className="card">
        <p className="meta">Loading on-chain results...</p>
      </article>
    );
  }

  if (roomStateQuery.error) {
    return (
      <article className="card">
        <p className="meta" style={{ color: "#b42318" }}>
          Failed to read room state: {roomStateQuery.error.message}
        </p>
      </article>
    );
  }

  if (scoresQuery.error) {
    return (
      <article className="card">
        <p className="meta" style={{ color: "#b42318" }}>
          Failed to read participant scores: {scoresQuery.error.message}
        </p>
      </article>
    );
  }

  return (
    <div className="grid">
      <Leaderboard entries={leaderboardEntries} />
      <ResultReceipt
        receipt={{
          roomId: roomAddress,
          text: latestReceiptText || "No AI receipt stored yet.",
          payoutStatus: payoutComplete ? "paid" : settled ? "pending" : "pending",
          winnerWallet: winner ?? "--",
          payoutTx: "--"
        }}
      />
    </div>
  );
}
