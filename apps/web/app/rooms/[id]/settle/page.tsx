import Link from "next/link";
import { isAddress } from "viem";

type RoomSettlePageProps = {
  params: Promise<{ id: string }>;
};

export default async function RoomSettlePage({ params }: RoomSettlePageProps) {
  const { id } = await params;
  const roomAddress = isAddress(id) ? id : null;

  return (
    <div style={{ maxWidth: "52rem", display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="page-head">
        <span className="section-header">Creator Console</span>
        <h1 className="page-head__title">Settlement Console</h1>
        <p>Room ID: <span className="mono">{id}</span></p>
      </div>

      <div className="glass-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.6rem" }}>
          <h2 className="section-title" style={{ margin: 0 }}>
            Local Mock Settlement
          </h2>
          <span className="badge badge-purple">BOT Mainnet</span>
        </div>
        <p className="meta">
          Use this for the BOT Chain mainnet demo flow where the creator submits a mock agent callback to settle the room.
        </p>

        {roomAddress ? (
          <>
            <p className="meta" style={{ marginTop: "0.7rem" }}>
              Run this from the repo root while the BOT Chain mainnet and frontend are running:
            </p>
            <pre className="receipt" style={{ marginTop: "0.6rem" }}>
              ROOM_ADDRESS={roomAddress} pnpm --filter @proofplay/contracts settle:local
            </pre>
          </>
        ) : (
          <p className="error-msg" style={{ marginTop: "0.7rem" }}>
            Settlement command is available only when the route id is a room contract address.
          </p>
        )}

        <p className="meta" style={{ marginTop: "0.8rem" }}>
          The script locks the room (if needed), emits a settlement request, builds deterministic mock stats from submitted
          lineups, and calls <code>onAgentResponse</code> as room creator.
        </p>
      </div>

      <div className="btn-row">
        <Link className="btn" href={`/rooms/${id}`}>
          Back to room
        </Link>
        <Link className="btn ghost" href={`/rooms/${id}/results`}>
          Open results
        </Link>
      </div>
    </div>
  );
}