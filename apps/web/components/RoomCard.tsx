import Link from "next/link";
import type { Room } from "@proofplay/shared";

type RoomCardProps = {
  room: Room;
  matchLabel: string;
};

export function RoomCard({ room, matchLabel }: RoomCardProps) {
  return (
    <article className="card room-card">
      <div className="room-card__head">
        <h2>{matchLabel}</h2>
        <span className={`pill ${room.status}`}>{room.status.toUpperCase()}</span>
      </div>

      <p className="room-meta">
        Entry: {room.entryFee} BOT | Max: {room.maxParticipants} | Deadline: {new Date(room.deadline).toLocaleString("en-GB", { timeZone: "UTC" })} UTC
      </p>

      <div className="btn-row">
        <Link className="btn primary" href={`/rooms/${room.id}`}>
          Open room
        </Link>
        <Link className="btn ghost" href={`/rooms/${room.id}/results`}>
          View results
        </Link>
      </div>
    </article>
  );
}
