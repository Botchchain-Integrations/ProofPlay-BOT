"use client";

import Link from "next/link";
import { useState } from "react";
import { useParams } from "next/navigation";
import { isAddress } from "viem";

type SettleResponse = {
  ok?: boolean;
  error?: { code?: string; message?: string };
  data?: {
    alreadySettled?: boolean;
    alreadyClaimed?: boolean;
    winner?: string | null;
    highestScore?: number;
    prizePool?: string;
    statsHash?: string;
    receiptText?: string;
    txHash?: string;
    settledPlayers?: number;
    participants?: { address: string; score: number; lineup: number[] }[];
  };
};

// Creator console. BOT Chain runs MatchRoomFactory with somniaPlatform =
// address(0), so the contract's own requestSettlement path reverts and the room
// must be settled through onAgentResponse, which is creator-only. The server
// endpoint reads the real final stats from the football provider and submits
// them signed by the creator key; the contract then scores every lineup
// on-chain, so the winner is decided by contract logic.
export default function RoomSettlePage() {
  const params = useParams<{ id: string }>();
  const roomAddress = typeof params?.id === "string" ? params.id : "";
  const roomValid = isAddress(roomAddress);

  const [fixtureId, setFixtureId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SettleResponse["data"] | null>(null);

  async function run(action: "settle" | "claim") {
    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/settle-room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomAddress, fixtureId: fixtureId.trim(), action })
      });
      const body = (await response.json()) as SettleResponse;

      if (!body?.ok) {
        setError(body?.error?.message ?? "Settlement failed.");
        return;
      }

      setResult(body.data ?? null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Settlement failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: "52rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="page-head">
        <span className="section-header">Creator Console</span>
        <h1 className="page-head__title">Settlement Console</h1>
        <p>
          Room ID: <span className="mono">{roomAddress}</span>
        </p>
      </div>

      <div className="glass-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Settle with final match stats
          </h2>
          <span className="badge badge-purple">BOT Mainnet</span>
        </div>
        <p className="meta">
          Reads the final player stats for the fixture and submits them on-chain so the contract scores
          every lineup itself. Settlement is only possible after the match has finished, and it must be
          submitted by the room creator&apos;s key.
        </p>

        {roomValid ? (
          <>
            <div className="form-grid" style={{ marginTop: "0.8rem" }}>
              <div className="field">
                <label>Fixture ID</label>
                <input
                  type="text"
                  value={fixtureId}
                  placeholder="e.g. 808488"
                  onChange={(event) => setFixtureId(event.target.value)}
                />
              </div>
            </div>

            <div className="btn-row" style={{ marginTop: "0.9rem" }}>
              <button className="btn primary" type="button" onClick={() => run("settle")} disabled={busy || !fixtureId.trim()}>
                {busy ? "Working..." : "Settle room"}
              </button>
              <button className="btn" type="button" onClick={() => run("claim")} disabled={busy}>
                Claim prize (winner)
              </button>
            </div>
          </>
        ) : (
          <p className="error-msg" style={{ marginTop: "0.7rem" }}>
            Settlement is available only when the URL contains a room contract address.
          </p>
        )}

        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {error ? <p className="error-msg">{error}</p> : null}

          {result?.alreadySettled ? <p className="success-msg">Room was already settled.</p> : null}
          {result?.alreadyClaimed ? <p className="success-msg">Prize was already claimed.</p> : null}

          {result?.winner ? (
            <p className="success-msg">
              Winner: <span className="mono">{result.winner}</span> with {result.highestScore ?? 0} points
            </p>
          ) : null}

          {result?.prizePool ? (
            <p className="tx-line">
              Prize pool: <span className="mono">{result.prizePool}</span> wei
            </p>
          ) : null}

          {result?.statsHash && result.statsHash !== "0x" + "0".repeat(64) ? (
            <p className="tx-line">
              Stats hash: <span className="mono">{result.statsHash}</span>
            </p>
          ) : null}

          {result?.txHash && result.txHash !== "0x" + "0".repeat(64) ? (
            <p className="tx-line">
              Tx hash: <span className="mono">{result.txHash}</span>
            </p>
          ) : null}

          {result?.participants?.length ? (
            <div style={{ marginTop: "0.5rem" }}>
              <p className="meta">Scores</p>
              {result.participants.map((entry) => (
                <p key={entry.address} className="tx-line">
                  <span className="mono">{entry.address}</span> - {entry.score} pts (lineup:{" "}
                  {entry.lineup.join(", ") || "none"})
                </p>
              ))}
            </div>
          ) : null}

          <Link className="btn ghost" href={`/rooms/${roomAddress}/results`} style={{ alignSelf: "flex-start", marginTop: "0.5rem" }}>
            Open results
          </Link>
        </div>
      </div>

      <div className="btn-row">
        <Link className="btn" href={`/rooms/${roomAddress}`}>
          Back to room
        </Link>
      </div>
    </div>
  );
}