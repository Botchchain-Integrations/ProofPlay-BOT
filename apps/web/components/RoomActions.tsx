"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@proofplay/shared";
import { formatEther, isAddress, parseEther, type Address } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract
} from "wagmi";
import {
  useContractAddresses,
  fantasyMatchRoomAbi,
  hasConfiguredAddress,
  LAST_ROOM_ADDRESS_STORAGE_KEY,
  ZERO_ADDRESS
} from "@/lib/contracts";

type RoomActionsProps = {
  entryFee: string;
  players: Player[];
  initialRoomAddress?: string;
};

function normalizeAddress(value: string): Address {
  if (isAddress(value)) {
    return value as Address;
  }

  return ZERO_ADDRESS;
}

function shortenAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function RoomActions({ entryFee, players, initialRoomAddress }: RoomActionsProps) {
  const { isConnected, address } = useAccount();
  const contractAddresses = useContractAddresses();

  const [roomAddressInput, setRoomAddressInput] = useState<string>(() => {
    if (initialRoomAddress && isAddress(initialRoomAddress)) {
      return initialRoomAddress;
    }

    return contractAddresses.room;
  });
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);

  const joinMutation = useWriteContract();
  const joinReceipt = useWaitForTransactionReceipt({ hash: joinMutation.data });

  const submitMutation = useWriteContract();
  const submitReceipt = useWaitForTransactionReceipt({ hash: submitMutation.data });
  const lockMutation = useWriteContract();
  const lockReceipt = useWaitForTransactionReceipt({ hash: lockMutation.data });
  const requestSettlementMutation = useWriteContract();
  const requestSettlementReceipt = useWaitForTransactionReceipt({ hash: requestSettlementMutation.data });
  const claimMutation = useWriteContract();
  const claimReceipt = useWaitForTransactionReceipt({ hash: claimMutation.data });

  useEffect(() => {
    if (initialRoomAddress && isAddress(initialRoomAddress)) {
      setRoomAddressInput(initialRoomAddress);
      window.localStorage.setItem(LAST_ROOM_ADDRESS_STORAGE_KEY, initialRoomAddress);
      return;
    }

    const savedAddress = window.localStorage.getItem(LAST_ROOM_ADDRESS_STORAGE_KEY);

    if (savedAddress && isAddress(savedAddress)) {
      setRoomAddressInput(savedAddress);
    }
  }, [initialRoomAddress]);

  useEffect(() => {
    if (isAddress(roomAddressInput)) {
      window.localStorage.setItem(LAST_ROOM_ADDRESS_STORAGE_KEY, roomAddressInput);
    }
  }, [roomAddressInput, address]);

  const roomAddress = useMemo(() => normalizeAddress(roomAddressInput), [roomAddressInput]);
  const roomConfigured = hasConfiguredAddress(roomAddress);
  const fallbackEntryFeeWei = useMemo(() => {
    try {
      return parseEther(entryFee);
    } catch {
      return 0n;
    }
  }, [entryFee]);

  const roomEntryFeeQuery = useReadContract({
    abi: fantasyMatchRoomAbi,
    address: roomAddress,
    functionName: "entryFee",
    query: {
      enabled: roomConfigured
    }
  });
  const onChainEntryFeeWei =
    typeof roomEntryFeeQuery.data === "bigint" ? roomEntryFeeQuery.data : null;
  const joinEntryFeeWei = onChainEntryFeeWei ?? fallbackEntryFeeWei;
  const joinEntryFeeLabel = onChainEntryFeeWei ? formatEther(onChainEntryFeeWei) : entryFee;
  const roomStateQuery = useReadContracts({
    contracts: roomConfigured
      ? [
          {
            abi: fantasyMatchRoomAbi,
            address: roomAddress,
            functionName: "locked" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: roomAddress,
            functionName: "settled" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: roomAddress,
            functionName: "payoutComplete" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: roomAddress,
            functionName: "lineupDeadline" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: roomAddress,
            functionName: "maxParticipants" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: roomAddress,
            functionName: "winner" as const
          },
          {
            abi: fantasyMatchRoomAbi,
            address: roomAddress,
            functionName: "getParticipants" as const
          }
        ]
      : [],
    query: {
      enabled: roomConfigured
    }
  });
  const userLineupQuery = useReadContract({
    abi: fantasyMatchRoomAbi,
    address: roomAddress,
    functionName: "getLineup",
    args: [(address ?? ZERO_ADDRESS) as Address],
    query: {
      enabled: roomConfigured && Boolean(address)
    }
  });
  const locked = roomStateQuery.data?.[0]?.result === true;
  const settled = roomStateQuery.data?.[1]?.result === true;
  const payoutComplete = roomStateQuery.data?.[2]?.result === true;
  const lineupDeadline =
    typeof roomStateQuery.data?.[3]?.result === "bigint" ? roomStateQuery.data[3].result : 0n;
  const maxParticipants =
    typeof roomStateQuery.data?.[4]?.result === "bigint" ? roomStateQuery.data[4].result : 0n;
  const winnerAddress =
    typeof roomStateQuery.data?.[5]?.result === "string" && isAddress(roomStateQuery.data[5].result)
      ? (roomStateQuery.data[5].result as Address)
      : ZERO_ADDRESS;
  const participants = ((roomStateQuery.data?.[6]?.result as Address[] | undefined) ?? []).filter((value) =>
    isAddress(value)
  );
  const deadlinePassed = lineupDeadline > 0n && BigInt(Math.floor(Date.now() / 1000)) >= lineupDeadline;
  const roomFull = maxParticipants > 0n && BigInt(participants.length) >= maxParticipants;
  const userJoined = address
    ? participants.some((participant) => participant.toLowerCase() === address.toLowerCase())
    : false;
  const userLineup = (userLineupQuery.data as readonly bigint[] | undefined) ?? [];
  const userLineupSubmitted = userLineup.length > 0;
  const isWinner =
    Boolean(address) &&
    winnerAddress.toLowerCase() !== ZERO_ADDRESS.toLowerCase() &&
    winnerAddress.toLowerCase() === address?.toLowerCase();
  const lineupSelectionValid =
    selectedPlayerIds.length === 5 && selectedPlayerIds.includes(Number(captainId));
  const canJoin =
    isConnected &&
    roomConfigured &&
    !locked &&
    !settled &&
    !deadlinePassed &&
    !roomFull &&
    !userJoined &&
    joinEntryFeeWei > 0n;
  const canSubmit =
    isConnected &&
    roomConfigured &&
    !locked &&
    !settled &&
    !deadlinePassed &&
    userJoined;
  const canLock = isConnected && roomConfigured && !locked && !settled;
  const canRequestSettlement = isConnected && roomConfigured && locked && !settled;
  const canClaim = isConnected && roomConfigured && settled && !payoutComplete && Boolean(isWinner);
  const joinButtonLabel = joinMutation.isPending
    ? "Joining..."
    : !isConnected
      ? "Connect wallet to join"
      : !roomConfigured
        ? "Set room address"
        : settled
          ? "Room Settled"
          : locked
            ? "Room Locked"
            : deadlinePassed
              ? "Deadline Passed"
              : roomFull
                ? "Room Full"
                : userJoined
                  ? "Joined"
                  : `Join Room (${joinEntryFeeLabel} BOT)`;
  const submitButtonLabel = submitMutation.isPending
    ? "Submitting..."
    : userLineupSubmitted && canSubmit
      ? "Update Lineup"
      : "Submit Lineup";
  const lockButtonLabel = lockMutation.isPending ? "Locking..." : locked ? "Room Locked" : "Lock Room";
  const requestSettlementButtonLabel = requestSettlementMutation.isPending
    ? "Requesting..."
    : settled
      ? "Already Settled"
      : locked
        ? "Request Settlement"
        : "Lock First";
  const claimButtonLabel = claimMutation.isPending
    ? "Claiming..."
    : payoutComplete
      ? "Claimed"
      : settled
        ? isWinner
          ? "Claim Prize"
          : "Not Winner"
        : "Not Settled";

  function togglePlayer(playerId: number) {
    setSelectedPlayerIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId);
      }

      if (current.length >= 5) {
        return current;
      }

      return [...current, playerId];
    });
  }

  function handleJoinRoom() {
    setFormError(null);

    if (!isConnected) {
      setFormError("Connect wallet before joining room.");
      return;
    }

    if (!roomConfigured) {
      setFormError("Set a valid room contract address.");
      return;
    }

    if (!canJoin) {
      setFormError("Room is not joinable in the current state.");
      return;
    }

    try {
      joinMutation.writeContract({
        abi: fantasyMatchRoomAbi,
        address: roomAddress,
        functionName: "joinRoom",
        value: joinEntryFeeWei
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to submit join transaction.");
    }
  }

  function handleSubmitLineup() {
    setFormError(null);

    if (!isConnected) {
      setFormError("Connect wallet before submitting lineup.");
      return;
    }

    if (!roomConfigured) {
      setFormError("Set a valid room contract address.");
      return;
    }

    if (!canSubmit) {
      setFormError("You can only submit lineup after joining an open room.");
      return;
    }

    if (selectedPlayerIds.length !== 5) {
      setFormError("Select exactly 5 players.");
      return;
    }

    const captain = Number(captainId);

    if (!selectedPlayerIds.includes(captain)) {
      setFormError("Captain must be one of the selected players.");
      return;
    }

    try {
      submitMutation.writeContract({
        abi: fantasyMatchRoomAbi,
        address: roomAddress,
        functionName: "submitLineup",
        args: [selectedPlayerIds.map((id) => BigInt(id)), BigInt(captain)]
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to submit lineup transaction.");
    }
  }

  function handleLockRoom() {
    setFormError(null);

    if (!isConnected) {
      setFormError("Connect wallet before locking room.");
      return;
    }

    if (!roomConfigured) {
      setFormError("Set a valid room contract address.");
      return;
    }

    if (!canLock) {
      setFormError("Room cannot be locked in current state.");
      return;
    }

    try {
      lockMutation.writeContract({
        abi: fantasyMatchRoomAbi,
        address: roomAddress,
        functionName: "lockRoom"
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to submit lock transaction.");
    }
  }

  function handleRequestSettlement() {
    setFormError(null);

    if (!isConnected) {
      setFormError("Connect wallet before requesting settlement.");
      return;
    }

    if (!roomConfigured) {
      setFormError("Set a valid room contract address.");
      return;
    }

    if (!canRequestSettlement) {
      setFormError("Settlement can only be requested after room is locked.");
      return;
    }

    try {
      requestSettlementMutation.writeContract({
        abi: fantasyMatchRoomAbi,
        address: roomAddress,
        functionName: "requestSettlement"
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to submit settlement request.");
    }
  }

  function handleClaimPrize() {
    setFormError(null);

    if (!isConnected) {
      setFormError("Connect wallet before claiming prize.");
      return;
    }

    if (!roomConfigured) {
      setFormError("Set a valid room contract address.");
      return;
    }

    if (!canClaim) {
      setFormError("Prize is claimable only by winner after settlement.");
      return;
    }

    try {
      claimMutation.writeContract({
        abi: fantasyMatchRoomAbi,
        address: roomAddress,
        functionName: "claimPrize"
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to submit claim transaction.");
    }
  }

  return (
    <div className="glass-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          On-Chain Actions
        </h2>
        <span className="badge badge-cyan">BOT Chain</span>
      </div>
      <p className="meta">Join, submit your lineup, and settle against the FantasyMatchRoom contract.</p>

      <div className="field" style={{ marginTop: "1rem" }}>
        <label>Room Contract Address</label>
        <input
          value={roomAddressInput}
          onChange={(event) => setRoomAddressInput(event.target.value)}
          placeholder="0x..."
        />
      </div>

      {roomConfigured ? (
        <div className="kv-grid" style={{ marginTop: "0.75rem" }}>
          <div className="kv-item">
            <dt>Status</dt>
            <dd>
              <span className={`pill ${settled ? "settled" : locked ? "locked" : "open"}`}>
                {(settled ? "settled" : locked ? "locked" : "open").toUpperCase()}
              </span>
            </dd>
          </div>
          <div className="kv-item">
            <dt>Entry Fee</dt>
            <dd>{joinEntryFeeLabel} BOT</dd>
          </div>
          <div className="kv-item">
            <dt>Room Fill</dt>
            <dd>
              {participants.length}/{Number(maxParticipants)}
            </dd>
          </div>
        </div>
      ) : null}

      <div className="btn-row" style={{ marginTop: "0.9rem" }}>
        <button className="btn primary" type="button" onClick={handleJoinRoom} disabled={!canJoin}>
          {joinButtonLabel}
        </button>
      </div>

      <div style={{ marginTop: "1.1rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "0.6rem" }}>
          <h3 style={{ margin: 0, fontSize: "0.8125rem", fontWeight: 700, color: "var(--zinc-300)" }}>
            Lineup Selection (Pick 5)
          </h3>
          <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--green)" }}>
            {selectedPlayerIds.length}/5 selected
          </span>
        </div>

        {players.length > 0 ? (
          <div className="player-chip-wrap">
            {players.map((player) => {
              const selected = selectedPlayerIds.includes(player.id);
              const captain = selected && Number(captainId) === player.id;

              return (
                <button
                  key={player.id}
                  className={`player-chip ${selected ? "is-selected" : ""} ${captain ? "is-captain" : ""}`}
                  type="button"
                  onClick={() => togglePlayer(player.id)}
                >
                  <strong>{player.name}</strong>
                  <span>
                    {player.position} · {player.team}
                  </span>
                  {captain ? <em>Captain</em> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="glass" style={{ padding: "0.75rem", borderRadius: "0.5rem" }}>
            <p className="meta" style={{ fontSize: "0.8125rem" }}>
              No player pool loaded for this match.
            </p>
          </div>
        )}

        <div className="field" style={{ marginTop: "0.85rem", maxWidth: "18rem" }}>
          <label>Captain</label>
          <select value={captainId} onChange={(event) => setCaptainId(event.target.value)}>
            <option value="">Select captain</option>
            {selectedPlayerIds.map((playerId) => {
              const player = players.find((item) => item.id === playerId);
              return (
                <option key={playerId} value={playerId}>
                  {player ? `${player.name} (${player.position})` : `Player ${playerId}`}
                </option>
              );
            })}
          </select>
        </div>

        <p className="chip-caption">
          Formation 1 GK · 1 DEF · 2 MID · 1 FWD. Captain scores double.
        </p>

        <div className="btn-row" style={{ marginTop: "0.7rem" }}>
          <button
            className="btn"
            type="button"
            onClick={handleSubmitLineup}
            disabled={!canSubmit || !lineupSelectionValid}
          >
            {submitButtonLabel}
          </button>
        </div>

        <div className="btn-row" style={{ marginTop: "0.7rem" }}>
          <button className="btn" type="button" onClick={handleLockRoom} disabled={!canLock}>
            {lockButtonLabel}
          </button>
          <button
            className="btn"
            type="button"
            onClick={handleRequestSettlement}
            disabled={!canRequestSettlement}
          >
            {requestSettlementButtonLabel}
          </button>
          <button
            className={`btn ${canClaim ? "primary" : ""}`}
            type="button"
            onClick={handleClaimPrize}
            disabled={!canClaim}
          >
            {claimButtonLabel}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "1.1rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
        {formError ? <p className="error-msg">{formError}</p> : null}
        {joinMutation.error ? <p className="error-msg">{joinMutation.error.message}</p> : null}
        {submitMutation.error ? <p className="error-msg">{submitMutation.error.message}</p> : null}
        {lockMutation.error ? <p className="error-msg">{lockMutation.error.message}</p> : null}
        {requestSettlementMutation.error ? (
          <p className="error-msg">{requestSettlementMutation.error.message}</p>
        ) : null}
        {claimMutation.error ? <p className="error-msg">{claimMutation.error.message}</p> : null}
        {roomEntryFeeQuery.error ? (
          <p className="error-msg">Failed to read room entry fee: {roomEntryFeeQuery.error.message}</p>
        ) : null}
        {roomStateQuery.error ? (
          <p className="error-msg">Failed to read room state: {roomStateQuery.error.message}</p>
        ) : null}
        {userLineupQuery.error ? (
          <p className="error-msg">Failed to read your lineup state: {userLineupQuery.error.message}</p>
        ) : null}

        {joinMutation.data ? <p className="tx-line">Join tx: {joinMutation.data}</p> : null}
        {submitMutation.data ? <p className="tx-line">Lineup tx: {submitMutation.data}</p> : null}
        {lockMutation.data ? <p className="tx-line">Lock tx: {lockMutation.data}</p> : null}
        {requestSettlementMutation.data ? (
          <p className="tx-line">Settlement request tx: {requestSettlementMutation.data}</p>
        ) : null}
        {claimMutation.data ? <p className="tx-line">Claim tx: {claimMutation.data}</p> : null}

        {joinReceipt.isLoading ? <p className="tx-line">Waiting on join confirmation...</p> : null}
        {joinReceipt.isSuccess ? <p className="success-msg">Join confirmed.</p> : null}
        {submitReceipt.isLoading ? <p className="tx-line">Waiting on lineup confirmation...</p> : null}
        {submitReceipt.isSuccess ? <p className="success-msg">Lineup confirmed.</p> : null}
        {lockReceipt.isLoading ? <p className="tx-line">Waiting on lock confirmation...</p> : null}
        {lockReceipt.isSuccess ? <p className="success-msg">Room locked.</p> : null}
        {requestSettlementReceipt.isLoading ? (
          <p className="tx-line">Waiting on settlement request confirmation...</p>
        ) : null}
        {requestSettlementReceipt.isSuccess ? <p className="success-msg">Settlement requested.</p> : null}
        {claimReceipt.isLoading ? <p className="tx-line">Waiting on claim confirmation...</p> : null}
        {claimReceipt.isSuccess ? <p className="success-msg">Prize claimed.</p> : null}

        {address ? (
          <p className="tx-line" style={{ color: "var(--zinc-600)" }}>
            You: {shortenAddress(address)}
          </p>
        ) : null}
      </div>
    </div>
  );
}