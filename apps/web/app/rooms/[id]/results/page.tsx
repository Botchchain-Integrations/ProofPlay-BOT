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
      <section>
        <h1 className="section-title">On-Chain Room Results</h1>
        <p className="meta">Room ID: {id}</p>

        <div style={{ marginTop: "1rem" }}>
          <OnChainRoomResults roomAddress={id} />
        </div>

        <div className="btn-row" style={{ marginTop: "1rem" }}>
          <Link className="btn" href={`/rooms/${id}`}>
            Back to room
          </Link>
        </div>
      </section>
    );
  }

  const room = getRoomById(id);

  if (!room) {
    return (
      <section className="card">
        <h1>Results not found</h1>
        <p className="meta">No room exists for id: {id}</p>
        <Link href="/rooms" className="btn">
          Back to rooms
        </Link>
      </section>
    );
  }

  const leaderboard = getLeaderboardForRoom(room.id);
  const receipt = getReceiptForRoom(room.id);

  return (
    <section>
      <h1 className="section-title">Results: {getMatchLabel(room.matchId)}</h1>
      <p className="meta">Room ID: {room.id}</p>

      <div className="grid">
        <Leaderboard entries={leaderboard} />
        {receipt ? <ResultReceipt receipt={receipt} /> : null}
      </div>

      <div className="btn-row" style={{ marginTop: "1rem" }}>
        <Link className="btn" href={`/rooms/${room.id}`}>
          Back to room
        </Link>
      </div>
    </section>
  );
}
