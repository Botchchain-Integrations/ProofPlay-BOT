"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isAddress, keccak256, parseEther, toBytes, type Address } from "viem";
import { useAccount, useChainId, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { Match } from "@proofplay/shared";
import {
  useContractAddresses,
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

function CreateRoomForm() {
  const contractAddresses = useContractAddresses();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const publicClient = usePublicClient();
  const writeContract = useWriteContract();
  const txHash = writeContract.data;

  const waitForReceipt = useWaitForTransactionReceipt({
    hash: txHash
  });

  const [matchId, setMatchId] = useState(demoMatches[0]?.id ?? "");
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [entryFee, setEntryFee] = useState("5");
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [minimumDeadline] = useState(() => toDateTimeLocalValue(new Date(Date.now() + 60 * 1000)));
  const [deadline, setDeadline] = useState(() => toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [formError, setFormError] = useState<string | null>(null);
  const [latestRoomAddress, setLatestRoomAddress] = useState<Address | null>(null);
  const [latestRoomLookupError, setLatestRoomLookupError] = useState<string | null>(null);

  const combinedMatches = useMemo(() => {
    const seen = new Set<string>();
    const all: Match[] = [];

    for (const match of [...liveMatches, ...demoMatches]) {
      if (match.status !== "upcoming") {
        continue;
      }
      if (seen.has(match.id)) {
        continue;
      }
      seen.add(match.id);
      all.push(match);
    }

    return all;
  }, [liveMatches]);

  const selectedMatch = useMemo(
    () => combinedMatches.find((match) => match.id === matchId) ?? combinedMatches[0],
    [combinedMatches, matchId]
  );

  useEffect(() => {
    let active = true;

    fetch("/api/matches", { cache: "no-store" })
      .then((response) => response.json())
      .then((body: { ok?: boolean; data?: { matches?: Match[] } }) => {
        if (!active) {
          return;
        }
        if (body?.ok && Array.isArray(body.data?.matches)) {
          setLiveMatches(body.data.matches);
        }
      })
      .catch(() => {
        // keep demo matches when the live feed is unavailable
      });

    return () => {
      active = false;
    };
  }, []);

  const canWriteFactory = hasConfiguredAddress(contractAddresses.factory);
  const canWriteRegistry = hasConfiguredAddress(contractAddresses.registry);

  useEffect(() => {
    const matchParam = searchParams.get("match");
    if (matchParam && combinedMatches.some((match) => match.id === matchParam)) {
      setMatchId(matchParam);
    }
  }, [searchParams, combinedMatches]);

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

  async function handleCreateRoom() {
    setFormError(null);
    setSeedError(null);
    setSeedMessage(null);

    if (!isConnected) {
      setFormError("Connect your wallet before creating a room.");
      return;
    }

    if (!canWriteFactory || !canWriteRegistry) {
      setFormError(
        "Factory or registry address is not configured for this network."
      );
      return;
    }

    const deadlineMs = new Date(deadline).getTime();

    if (!Number.isFinite(deadlineMs) || deadlineMs <= Date.now()) {
      setFormError("Deadline must be a valid future date.");
      return;
    }

    if (!selectedMatch) {
      setFormError("Select a match to create a room for.");
      return;
    }

    setSeeding(true);

    try {
      const seedResponse = await fetch("/api/seed-players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixtureId: selectedMatch.id,
          homeTeam: selectedMatch.homeTeam,
          awayTeam: selectedMatch.awayTeam,
          chainId
        })
      });
      const seedBody = (await seedResponse.json()) as {
        ok?: boolean;
        error?: { message?: string };
        data?: { alreadySeeded?: boolean; playerCount?: number };
      };

      if (!seedResponse.ok || !seedBody?.ok) {
        setSeedError(
          seedBody?.error?.message ?? "Could not seed the player pool for this match."
        );
        setSeeding(false);
        return;
      }

      setSeedMessage(
        seedBody.data?.alreadySeeded
          ? `Player pool already on-chain (${seedBody.data.playerCount} players).`
          : `Seeded ${seedBody.data?.playerCount ?? 0} players on-chain for this match.`
      );
    } catch (error) {
      setSeedError(error instanceof Error ? error.message : "Could not seed the player pool for this match.");
      setSeeding(false);
      return;
    }

    setSeeding(false);

    try {
      const matchKey = `${selectedMatch.id}:${selectedMatch.homeTeam}:${selectedMatch.awayTeam}`;
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
    <div style={{ maxWidth: "52rem" }}>
      <div className="page-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <span className="section-header">Create</span>
          <h1 className="page-head__title">Fantasy Match Room</h1>
          <p>This form sends a real createRoom(...) transaction to the factory contract.</p>
        </div>
        <Link href="/rooms" className="btn ghost">
          Back to rooms
        </Link>
      </div>

      <div className="glass-card">
        <div className="form-grid">
          <div className="field">
            <label>Match</label>
            <select value={matchId} onChange={(event) => setMatchId(event.target.value)}>
              {combinedMatches.map((match) => (
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

        <div className="btn-row" style={{ marginTop: "1.1rem" }}>
          <button className="btn primary" type="button" onClick={handleCreateRoom} disabled={seeding}>
            {seeding
              ? "Seeding player pool..."
              : writeContract.isPending
                ? "Sending..."
                : "Create Room"}
          </button>
          <span className={`pill ${isConnected ? "open" : ""}`}>
            {isConnected && address ? `Connected: ${shortenAddress(address)}` : "Connect wallet in header"}
          </span>
        </div>

        <div style={{ marginTop: "1.1rem", display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          <p className="tx-line">Factory: {contractAddresses.factory}</p>
          <p className="tx-line">Registry: {contractAddresses.registry}</p>
          {formError ? <p className="error-msg">{formError}</p> : null}
          {seedError ? <p className="error-msg">{seedError}</p> : null}
          {seedMessage ? <p className="success-msg">{seedMessage}</p> : null}
          {writeContract.error ? <p className="error-msg">{writeContract.error.message}</p> : null}
          {txHash ? <p className="tx-line">Tx hash: {txHash}</p> : null}
          {waitForReceipt.isLoading ? <p className="tx-line">Waiting for confirmation...</p> : null}
          {waitForReceipt.isSuccess ? <p className="success-msg">Transaction confirmed.</p> : null}
          {latestRoomLookupError ? <p className="error-msg">{latestRoomLookupError}</p> : null}
          {latestRoomAddress ? (
            <p className="success-msg">
              Latest room: <span className="mono">{latestRoomAddress}</span>{" "}
              <Link className="btn ghost" href={`/rooms/${latestRoomAddress}`} style={{ marginLeft: "0.5rem", padding: "0.3rem 0.7rem", fontSize: "0.75rem" }}>
                Open room
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function CreateRoomPage() {
  return (
    <Suspense fallback={<div className="loading-wrap"><div className="spinner" /></div>}>
      <CreateRoomForm />
    </Suspense>
  );
}