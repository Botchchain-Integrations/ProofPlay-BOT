"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@proofplay/shared";
import { formatEther, isAddress, parseEther, type Address } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  contractAddresses,
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

export function RoomActions({ entryFee, players, initialRoomAddress }: RoomActionsProps) {
  const { isConnected } = useAccount();

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
  }, [roomAddressInput]);

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
    <article className="card">
      <h2 className="section-title">On-Chain Room Actions</h2>
      <p className="meta">Join room and submit lineup against the deployed `FantasyMatchRoom` contract.</p>

      <div className="field" style={{ marginTop: "0.85rem" }}>
        <label>Room Contract Address</label>
        <input
          value={roomAddressInput}
          onChange={(event) => setRoomAddressInput(event.target.value)}
          placeholder="0x..."
        />
      </div>

      <div className="btn-row" style={{ marginTop: "0.85rem" }}>
        <button className="btn primary" type="button" onClick={handleJoinRoom}>
          {joinMutation.isPending ? "Joining..." : `Join Room (${joinEntryFeeLabel} STT)`}
        </button>
      </div>

      <div style={{ marginTop: "0.85rem" }}>
        <h3 style={{ margin: "0 0 0.45rem 0" }}>Lineup Selection (Pick 5)</h3>
        <div className="player-chip-wrap">
          {players.map((player) => {
            const selected = selectedPlayerIds.includes(player.id);

            return (
              <button
                key={player.id}
                className={`player-chip ${selected ? "is-selected" : ""}`}
                type="button"
                onClick={() => togglePlayer(player.id)}
              >
                <strong>{player.name}</strong>
                <span>
                  {player.position} | {player.team}
                </span>
              </button>
            );
          })}
        </div>

        <div className="field" style={{ marginTop: "0.85rem" }}>
          <label>Captain</label>
          <select value={captainId} onChange={(event) => setCaptainId(event.target.value)}>
            <option value="">Select captain</option>
            {selectedPlayerIds.map((playerId) => {
              const player = players.find((item) => item.id === playerId);
              return (
                <option key={playerId} value={playerId}>
                  {player?.name ?? `Player ${playerId}`}
                </option>
              );
            })}
          </select>
        </div>

        <div className="btn-row" style={{ marginTop: "0.85rem" }}>
          <button className="btn" type="button" onClick={handleSubmitLineup}>
            {submitMutation.isPending ? "Submitting..." : "Submit Lineup"}
          </button>
        </div>

        <div className="btn-row" style={{ marginTop: "0.85rem" }}>
          <button className="btn" type="button" onClick={handleLockRoom}>
            {lockMutation.isPending ? "Locking..." : "Lock Room"}
          </button>
          <button className="btn" type="button" onClick={handleRequestSettlement}>
            {requestSettlementMutation.isPending ? "Requesting..." : "Request Settlement"}
          </button>
          <button className="btn" type="button" onClick={handleClaimPrize}>
            {claimMutation.isPending ? "Claiming..." : "Claim Prize"}
          </button>
        </div>
      </div>

      <div style={{ marginTop: "0.85rem" }}>
        {formError ? <p className="meta" style={{ color: "#b42318" }}>{formError}</p> : null}
        {joinMutation.error ? <p className="meta" style={{ color: "#b42318" }}>{joinMutation.error.message}</p> : null}
        {submitMutation.error ? (
          <p className="meta" style={{ color: "#b42318" }}>{submitMutation.error.message}</p>
        ) : null}
        {lockMutation.error ? <p className="meta" style={{ color: "#b42318" }}>{lockMutation.error.message}</p> : null}
        {requestSettlementMutation.error ? (
          <p className="meta" style={{ color: "#b42318" }}>{requestSettlementMutation.error.message}</p>
        ) : null}
        {claimMutation.error ? <p className="meta" style={{ color: "#b42318" }}>{claimMutation.error.message}</p> : null}
        {roomEntryFeeQuery.error ? (
          <p className="meta" style={{ color: "#b42318" }}>
            Failed to read room entry fee: {roomEntryFeeQuery.error.message}
          </p>
        ) : null}
        {joinMutation.data ? <p className="meta">Join tx: {joinMutation.data}</p> : null}
        {submitMutation.data ? <p className="meta">Lineup tx: {submitMutation.data}</p> : null}
        {lockMutation.data ? <p className="meta">Lock tx: {lockMutation.data}</p> : null}
        {requestSettlementMutation.data ? (
          <p className="meta">Settlement request tx: {requestSettlementMutation.data}</p>
        ) : null}
        {claimMutation.data ? <p className="meta">Claim tx: {claimMutation.data}</p> : null}
        {joinReceipt.isLoading ? <p className="meta">Waiting on join confirmation...</p> : null}
        {joinReceipt.isSuccess ? <p className="meta">Join confirmed.</p> : null}
        {submitReceipt.isLoading ? <p className="meta">Waiting on lineup confirmation...</p> : null}
        {submitReceipt.isSuccess ? <p className="meta">Lineup confirmed.</p> : null}
        {lockReceipt.isLoading ? <p className="meta">Waiting on lock confirmation...</p> : null}
        {lockReceipt.isSuccess ? <p className="meta">Room locked.</p> : null}
        {requestSettlementReceipt.isLoading ? (
          <p className="meta">Waiting on settlement request confirmation...</p>
        ) : null}
        {requestSettlementReceipt.isSuccess ? <p className="meta">Settlement requested.</p> : null}
        {claimReceipt.isLoading ? <p className="meta">Waiting on claim confirmation...</p> : null}
        {claimReceipt.isSuccess ? <p className="meta">Prize claimed.</p> : null}
      </div>
    </article>
  );
}
