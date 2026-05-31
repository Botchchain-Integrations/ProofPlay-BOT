import Link from "next/link";
import { isAddress } from "viem";

type RoomSettlePageProps = {
  params: Promise<{ id: string }>;
};

export default async function RoomSettlePage({ params }: RoomSettlePageProps) {
  const { id } = await params;
  const roomAddress = isAddress(id) ? id : null;

  return (
    <section>
      <h1 className="section-title">Creator Settlement Console</h1>
      <p className="meta">Room ID: {id}</p>

      <article className="card" style={{ marginTop: "1rem" }}>
        <h2 className="section-title">Local Mock Settlement</h2>
        <p className="meta">
          Use this for the Anvil demo flow where the creator submits a mock agent callback to settle the room.
        </p>

        {roomAddress ? (
          <>
            <p className="meta" style={{ marginTop: "0.7rem" }}>
              Run this from the repo root while Anvil and frontend are running:
            </p>
            <pre className="receipt" style={{ marginTop: "0.6rem", whiteSpace: "pre-wrap" }}>
              ROOM_ADDRESS={roomAddress} pnpm --filter @proofplay/contracts settle:local
            </pre>
          </>
        ) : (
          <p className="meta" style={{ color: "#b42318", marginTop: "0.7rem" }}>
            Settlement command is available only when the route id is a room contract address.
          </p>
        )}

        <p className="meta" style={{ marginTop: "0.8rem" }}>
          The script locks the room (if needed), emits a settlement request, builds deterministic mock stats from submitted
          lineups, and calls <code>onAgentResponse</code> as room creator.
        </p>
      </article>

      <div className="btn-row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href={`/rooms/${id}`}>
          Back to room
        </Link>
        <Link className="btn ghost" href={`/rooms/${id}/results`}>
          Open results
        </Link>
      </div>
    </section>
  );
}
