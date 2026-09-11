"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isAddress, keccak256, parseEther, toBytes, type Address } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  contractAddresses,
  hasConfiguredAddress,
  LAST_ROOM_ADDRESS_STORAGE_KEY,
  matchRoomFactoryAbi
} from "@/lib/contracts";
import { demoMatches } from "@/lib/demo-data";

function shortenAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export default function CreateRoomPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const writeContract = useWriteContract();
  const txHash = writeContract.data;

  const waitForReceipt = useWaitForTransactionReceipt({
    hash: txHash
  });

  const [matchId, setMatchId] = useState(demoMatches[0]?.id ?? "");
  const [entryFee, setEntryFee] = useState("5");
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [minimumDeadline] = useState(() => toDateTimeLocalValue(new Date(Date.now() + 60 * 1000)));
  const [deadline, setDeadline] = useState(() => toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [formError, setFormError] = useState<string | null>(null);
  const [latestRoomAddress, setLatestRoomAddress] = useState<Address | null>(null);
  const [latestRoomLookupError, setLatestRoomLookupError] = useState<string | null>(null);

  const selectedMatch = useMemo(
    () => demoMatches.find((match) => match.id === matchId) ?? demoMatches[0],
    [matchId]
  );

  const canWriteFactory = hasConfiguredAddress(contractAddresses.factory);
  const canWriteRegistry = hasConfiguredAddress(contractAddresses.registry);

  useEffect(() => {
    let active = true;

    async function resolveLatestRoomAddress() {
      if (!waitForReceipt.isSuccess || !canWriteFactory || !publicClient) {
        return;
      }

      try {
        const rooms = (await publicClient.readContract({
          abi: matchRoomFactoryAbi,
          address: contractAddresses.factory,
          functionName: "getRooms"
        })) as Address[];
        const newestRoom = rooms.at(-1);

        if (!newestRoom || !isAddress(newestRoom)) {
          if (active) {
            setLatestRoomLookupError("Room created but latest room address could not be resolved.");
          }
          return;
        }

        if (!active) {
          return;
        }

        setLatestRoomAddress(newestRoom);
        setLatestRoomLookupError(null);
        window.localStorage.setItem(LAST_ROOM_ADDRESS_STORAGE_KEY, newestRoom);
      } catch (error) {
        if (!active) {
          return;
        }

        setLatestRoomLookupError(
          error instanceof Error
            ? `Room created but latest room lookup failed: ${error.message}`
            : "Room created but latest room lookup failed."
        );
      }
    }

    resolveLatestRoomAddress();

    return () => {
      active = false;
    };
  }, [waitForReceipt.isSuccess, canWriteFactory, publicClient]);

  function handleCreateRoom() {
    setFormError(null);

    if (!isConnected) {
      setFormError("Connect your wallet before creating a room.");
      return;
    }

    if (!canWriteFactory || !canWriteRegistry) {
      setFormError(
        "Factory or registry address is not configured. Set NEXT_PUBLIC_FACTORY_ADDRESS and NEXT_PUBLIC_REGISTRY_ADDRESS."
      );
      return;
    }

    const deadlineMs = new Date(deadline).getTime();

    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      setFormError("Deadline must be a valid future date.");
      return;
    }

    try {
      const matchKey = `${selectedMatch?.id ?? matchId}:${selectedMatch?.homeTeam ?? "home"}:${selectedMatch?.awayTeam ?? "away"}`;
      const hashedMatchId = keccak256(toBytes(matchKey));

      writeContract.writeContract({
        abi: matchRoomFactoryAbi,
        address: contractAddresses.factory,
        functionName: "createRoom",
        args: [
          hashedMatchId,
          parseEther(entryFee),
          BigInt(maxParticipants),
          BigInt(Math.floor(deadlineMs / 1000)),
          contractAddresses.registry
        ]
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create room transaction.");
    }
  }

  return (
    <section>
      <h1 className="section-title">Create Fantasy Match Room</h1>
      <p className="meta">This form now sends a real `createRoom(...)` transaction to your factory contract.</p>

      <article className="card" style={{ marginTop: "1rem" }}>
        <div className="form-grid">
          <div className="field">
            <label>Match</label>
            <select value={matchId} onChange={(event) => setMatchId(event.target.value)}>
              {demoMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.homeTeam} vs {match.awayTeam}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Entry Fee (BOT)</label>
            <input
              type="number"
              value={entryFee}
              min="0"
              step="0.0001"
              onChange={(event) => setEntryFee(event.target.value)}
            />
          </div>

          <div className="field">
            <label>Max Participants</label>
            <input
              type="number"
              value={maxParticipants}
              min="2"
              onChange={(event) => setMaxParticipants(event.target.value)}
            />
          </div>

          <div className="field">
            <label>Lineup Deadline</label>
            <input
              type="datetime-local"
              value={deadline}
              min={minimumDeadline}
              onChange={(event) => setDeadline(event.target.value)}
            />
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: "1rem" }}>
          <button className="btn primary" type="button" onClick={handleCreateRoom}>
            {writeContract.isPending ? "Sending..." : "Create Room"}
          </button>
          <span className={`pill ${isConnected ? "open" : ""}`}>
            {isConnected && address ? `Connected: ${shortenAddress(address)}` : "Connect wallet in header"}
          </span>
        </div>

        <div style={{ marginTop: "1rem" }}>
          <p className="meta">Factory: {contractAddresses.factory}</p>
          <p className="meta">Registry: {contractAddresses.registry}</p>
          {formError ? <p className="meta" style={{ color: "#b42318" }}>{formError}</p> : null}
          {writeContract.error ? (
            <p className="meta" style={{ color: "#b42318" }}>
              {writeContract.error.message}
            </p>
          ) : null}
          {txHash ? <p className="meta">Tx hash: {txHash}</p> : null}
          {waitForReceipt.isLoading ? <p className="meta">Waiting for confirmation...</p> : null}
          {waitForReceipt.isSuccess ? <p className="meta">Transaction confirmed.</p> : null}
          {latestRoomLookupError ? (
            <p className="meta" style={{ color: "#b42318" }}>
              {latestRoomLookupError}
            </p>
          ) : null}
          {latestRoomAddress ? (
            <p className="meta">
              Latest room: {latestRoomAddress}{" "}
              <Link href={`/rooms/${latestRoomAddress}`} className="btn ghost" style={{ marginLeft: "0.5rem" }}>
                Open room
              </Link>
            </p>
          ) : null}
        </div>
      </article>
    </section>
  );
}
