"use client";

import { useEffect, useMemo, useState } from "react";
import type { Player } from "@proofplay/shared";
import { isAddress, parseEther, type Address } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
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
        value: parseEther(entryFee)
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
          {joinMutation.isPending ? "Joining..." : `Join Room (${entryFee} STT)`}
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
      </div>

      <div style={{ marginTop: "0.85rem" }}>
        {formError ? <p className="meta" style={{ color: "#b42318" }}>{formError}</p> : null}
        {joinMutation.error ? <p className="meta" style={{ color: "#b42318" }}>{joinMutation.error.message}</p> : null}
        {submitMutation.error ? (
          <p className="meta" style={{ color: "#b42318" }}>{submitMutation.error.message}</p>
        ) : null}
        {joinMutation.data ? <p className="meta">Join tx: {joinMutation.data}</p> : null}
        {submitMutation.data ? <p className="meta">Lineup tx: {submitMutation.data}</p> : null}
        {joinReceipt.isLoading ? <p className="meta">Waiting on join confirmation...</p> : null}
        {joinReceipt.isSuccess ? <p className="meta">Join confirmed.</p> : null}
        {submitReceipt.isLoading ? <p className="meta">Waiting on lineup confirmation...</p> : null}
        {submitReceipt.isSuccess ? <p className="meta">Lineup confirmed.</p> : null}
      </div>
    </article>
  );
}
