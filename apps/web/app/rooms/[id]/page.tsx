import Link from "next/link";
import type { Room } from "@proofplay/shared";
import { isAddress } from "viem";
import { LineupCard } from "@/components/LineupCard";
import { OnChainRoomStatus } from "@/components/OnChainRoomStatus";
import { PlayerPicker } from "@/components/PlayerPicker";
import { RoomActions } from "@/components/RoomActions";
import {
  demoMatches,
  getLineupsForRoom,
  getMatchLabel,
  getPlayersForMatch,
  getRoomById
} from "@/lib/demo-data";

type RoomPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RoomDetailsPage({ params }: RoomPageProps) {
  const { id } = await params;
  const routeIsAddress = isAddress(id);
  const room = getRoomById(id);

  if (!room && !routeIsAddress) {
    return (
      <section className="card">
        <h1>Room not found</h1>
        <p className="meta">No room exists for id: {id}</p>
        <Link href="/rooms" className="btn">
          Back to rooms
        </Link>
      </section>
    );
  }

  const resolvedRoom: Room =
    room ??
    ({
      id,
      matchId: demoMatches[0]?.id ?? "unknown-match",
      entryFee: "5",
      maxParticipants: 10,
      deadline: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      status: "open"
    } as const);

  const players = getPlayersForMatch(resolvedRoom.matchId);
  const lineups = room ? getLineupsForRoom(room.id) : [];
  const previewLineup = lineups[0];

  return (
    <section>
      <h1 className="section-title">
        {room ? getMatchLabel(room.matchId) : "On-Chain Fantasy Room"}
      </h1>
      <p className="meta">Room ID: {resolvedRoom.id}</p>
      {!room && routeIsAddress ? (
        <p className="meta" style={{ marginTop: "0.35rem" }}>
          This page is using a room contract address route and on-chain actions.
        </p>
      ) : null}

      <div className="grid">
        {routeIsAddress ? (
          <OnChainRoomStatus roomAddress={id} />
        ) : (
          <article className="card">
            <h2 className="section-title">Room Status</h2>
            <dl className="kv">
              <div>
                <dt>Status</dt>
                <dd>{resolvedRoom.status}</dd>
              </div>
              <div>
                <dt>Entry Fee</dt>
                <dd>{resolvedRoom.entryFee} STT</dd>
              </div>
              <div>
                <dt>Max Participants</dt>
                <dd>{resolvedRoom.maxParticipants}</dd>
              </div>
              <div>
                <dt>Lineup Deadline</dt>
                <dd>{new Date(resolvedRoom.deadline).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</dd>
              </div>
            </dl>
          </article>
        )}

        <RoomActions
          entryFee={resolvedRoom.entryFee}
          players={players}
          initialRoomAddress={routeIsAddress ? id : undefined}
        />
      </div>

      <div style={{ marginTop: "1rem" }}>
        <PlayerPicker
          players={players}
          selectedIds={previewLineup?.playerIds ?? []}
          captainId={previewLineup?.captainId}
        />
      </div>

      {previewLineup ? (
        <div style={{ marginTop: "1rem" }}>
          <LineupCard lineup={previewLineup} players={players} />
        </div>
      ) : null}

      <div className="btn-row" style={{ marginTop: "1rem" }}>
        <Link className="btn ghost" href={`/rooms/${resolvedRoom.id}/results`}>
          View Results Page
        </Link>
        <Link className="btn" href={`/rooms/${resolvedRoom.id}/settle`}>
          Creator Settle Helper
        </Link>
      </div>
    </section>
  );
}
