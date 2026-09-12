import Link from "next/link";
import { isAddress } from "viem";
import { Leaderboard } from "@/components/Leaderboard";
import { OnChainRoomResults } from "@/components/OnChainRoomResults";
import { ResultReceipt } from "@/components/ResultReceipt";
import { getLeaderboardForRoom, getMatchLabel, getReceiptForRoom, getRoomById } from "@/lib/demo-data";

type RoomResultsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RoomResultsPage({ params }: RoomResultsPageProps) {
  const { id } = await params;
  const routeIsAddress = isAddress(id);

  if (routeIsAddress) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <div className="page-head">
          <span className="section-header">Results</span>
          <h1 className="page-head__title">On-Chain Room Results</h1>
          <p>Room ID: <span className="mono">{id}</span></p>
        </div>

        <OnChainRoomResults roomAddress={id} />

        <div className="btn-row">
          <Link className="btn" href={`/rooms/${id}`}>
            Back to room
          </Link>
        </div>
      </div>
    );
  }

  const room = getRoomById(id);

  if (!room) {
    return (
      <div style={{ maxWidth: "36rem" }}>
        <div className="glass-card">
          <h1 className="page-title">Results not found</h1>
          <p className="meta" style={{ marginTop: "0.5rem" }}>
            No room exists for id: <span className="mono">{id}</span>
          </p>
          <div className="btn-row" style={{ marginTop: "1rem" }}>
            <Link href="/rooms" className="btn">
              Back to rooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const leaderboard = getLeaderboardForRoom(room.id);
  const receipt = getReceiptForRoom(room.id);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div className="page-head">
        <span className="section-header">Results</span>
        <h1 className="page-head__title">{getMatchLabel(room.matchId)}</h1>
        <p>Room ID: <span className="mono">{room.id}</span></p>
      </div>

      <div className="grid">
        <Leaderboard entries={leaderboard} />
        {receipt ? <ResultReceipt receipt={receipt} /> : null}
      </div>

      <div className="btn-row">
        <Link className="btn" href={`/rooms/${room.id}`}>
          Back to room
        </Link>
      </div>
    </div>
  );
}