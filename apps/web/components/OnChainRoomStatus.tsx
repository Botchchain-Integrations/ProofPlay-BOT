"use client";

import { formatEther, isAddress, type Address } from "viem";
import { useReadContracts } from "wagmi";
import { fantasyMatchRoomAbi, ZERO_ADDRESS } from "@/lib/contracts";

type OnChainRoomStatusProps = {
  roomAddress: string;
};

function asBigInt(value: unknown) {
  return typeof value === "bigint" ? value : 0n;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function asAddress(value: unknown) {
  if (typeof value === "string" && isAddress(value)) {
    return value as Address;
  }

  return null;
}

function formatDeadline(unixSeconds: bigint) {
  const numeric = Number(unixSeconds);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "--";
  }

  return `${new Date(numeric * 1000).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`;
}

function formatWinner(winner: Address | null) {
  if (!winner || winner.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return "--";
  }

  return winner;
}

export function OnChainRoomStatus({ roomAddress }: OnChainRoomStatusProps) {
  if (!isAddress(roomAddress)) {
    return (
      <article className="card">
        <h2 className="section-title">Room Status</h2>
        <p className="meta" style={{ color: "#b42318" }}>
          Invalid room address route.
        </p>
      </article>
    );
  }

  const resolvedRoomAddress = roomAddress as Address;

  const roomStateQuery = useReadContracts({
    contracts: [
      {
        abi: fantasyMatchRoomAbi,
        address: resolvedRoomAddress,
        functionName: "entryFee"
      },
      {
        abi: fantasyMatchRoomAbi,
        address: resolvedRoomAddress,
        functionName: "maxParticipants"
      },
      {
        abi: fantasyMatchRoomAbi,
        address: resolvedRoomAddress,
        functionName: "lineupDeadline"
      },
      {
        abi: fantasyMatchRoomAbi,
        address: resolvedRoomAddress,
        functionName: "locked"
      },
      {
        abi: fantasyMatchRoomAbi,
        address: resolvedRoomAddress,
        functionName: "settled"
      },
      {
        abi: fantasyMatchRoomAbi,
        address: resolvedRoomAddress,
        functionName: "winner"
      },
      {
        abi: fantasyMatchRoomAbi,
        address: resolvedRoomAddress,
        functionName: "payoutComplete"
      },
      {
        abi: fantasyMatchRoomAbi,
        address: resolvedRoomAddress,
        functionName: "getParticipants"
      }
    ]
  });

  if (roomStateQuery.isLoading) {
    return (
      <article className="card">
        <h2 className="section-title">Room Status</h2>
        <p className="meta">Loading on-chain room state...</p>
      </article>
    );
  }

  if (roomStateQuery.error) {
    return (
      <article className="card">
        <h2 className="section-title">Room Status</h2>
        <p className="meta" style={{ color: "#b42318" }}>
          Failed to read room status: {roomStateQuery.error.message}
        </p>
      </article>
    );
  }

  const entryFee = asBigInt(roomStateQuery.data?.[0]?.result);
  const maxParticipants = asBigInt(roomStateQuery.data?.[1]?.result);
  const lineupDeadline = asBigInt(roomStateQuery.data?.[2]?.result);
  const locked = asBoolean(roomStateQuery.data?.[3]?.result);
  const settled = asBoolean(roomStateQuery.data?.[4]?.result);
  const winner = asAddress(roomStateQuery.data?.[5]?.result);
  const payoutComplete = asBoolean(roomStateQuery.data?.[6]?.result);
  const participants = (roomStateQuery.data?.[7]?.result as Address[] | undefined) ?? [];

  const status = settled ? "settled" : locked ? "locked" : "open";

  return (
    <article className="card">
      <h2 className="section-title">Room Status</h2>
      <dl className="kv">
        <div>
          <dt>Status</dt>
          <dd>{status}</dd>
        </div>
        <div>
          <dt>Entry Fee</dt>
          <dd>{formatEther(entryFee)} BOT</dd>
        </div>
        <div>
          <dt>Participants</dt>
          <dd>
            {participants.length}/{Number(maxParticipants)}
          </dd>
        </div>
        <div>
          <dt>Lineup Deadline</dt>
          <dd>{formatDeadline(lineupDeadline)}</dd>
        </div>
        <div>
          <dt>Winner</dt>
          <dd>{formatWinner(winner)}</dd>
        </div>
        <div>
          <dt>Payout</dt>
          <dd>{payoutComplete ? "claimed" : settled ? "pending claim" : "not ready"}</dd>
        </div>
      </dl>
    </article>
  );
}
