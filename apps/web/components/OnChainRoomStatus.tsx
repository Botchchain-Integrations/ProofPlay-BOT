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

function shortenAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatWinner(winner: Address | null) {
  if (!winner || winner.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return "--";
  }

  return shortenAddress(winner);
}

export function OnChainRoomStatus({ roomAddress }: OnChainRoomStatusProps) {
  if (!isAddress(roomAddress)) {
    return (
      <div className="glass-card">
        <h2 className="section-title">Room Status</h2>
        <p className="error-msg">Invalid room address route.</p>
      </div>
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
      <div className="glass-card">
        <h2 className="section-title">Room Status</h2>
        <div className="loading-wrap" style={{ padding: "1.5rem" }}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (roomStateQuery.error) {
    return (
      <div className="glass-card">
        <h2 className="section-title">Room Status</h2>
        <p className="error-msg">Failed to read room status: {roomStateQuery.error.message}</p>
      </div>
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
    <div className="glass-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Room Status
        </h2>
        <span className={`pill ${status}`}>{status.toUpperCase()}</span>
      </div>

      <dl className="kv-grid">
        <div className="kv-item">
          <dt>Entry Fee</dt>
          <dd>{formatEther(entryFee)} BOT</dd>
        </div>
        <div className="kv-item">
          <dt>Participants</dt>
          <dd>
            {participants.length}/{Number(maxParticipants)}
          </dd>
        </div>
        <div className="kv-item">
          <dt>Lineup Deadline</dt>
          <dd className="mono">{formatDeadline(lineupDeadline)}</dd>
        </div>
        <div className="kv-item">
          <dt>Winner</dt>
          <dd className="mono">{formatWinner(winner)}</dd>
        </div>
        <div className="kv-item">
          <dt>Payout</dt>
          <dd>{payoutComplete ? "Claimed" : settled ? "Pending claim" : "Not ready"}</dd>
        </div>
      </dl>
    </div>
  );
}