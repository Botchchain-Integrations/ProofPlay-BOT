import Link from "next/link";
import type { Room } from "@proofplay/shared";
import { TeamEmblem } from "@/components/TeamEmblem";

type RoomCardProps = {
  room: Room;
  matchLabel: string;
};

function parseMatchLabel(matchLabel: string) {
  const [homeTeam = "Home", awayTeam = "Away"] = matchLabel.split(" vs ");
  return { homeTeam, awayTeam };
}

function formatDeadline(deadline: string) {
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function RoomCard({ room, matchLabel }: RoomCardProps) {
  const { homeTeam, awayTeam } = parseMatchLabel(matchLabel);

  return (
    <article className="glass-card fixture-row" style={{ padding: "0.9rem 1rem" }}>
      <div className="fixture-row__team home-team" style={{ flex: 1, minWidth: 0 }}>
        <TeamEmblem name={homeTeam} />
        <span>{homeTeam}</span>
      </div>

      <div className="fixture-row__center">
        <span style={{ fontSize: "0.8125rem", color: "var(--zinc-300)", fontWeight: 600 }}>vs</span>
        <span className={`pill ${room.status}`}>{room.status.toUpperCase()}</span>
      </div>

      <div className="fixture-row__team away-team" style={{ flex: 1, minWidth: 0 }}>
        <span>{awayTeam}</span>
        <TeamEmblem name={awayTeam} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
        <span className="mono" style={{ fontSize: "0.6875rem", color: "var(--zinc-500)" }}>
          {room.entryFee} BOT · {room.maxParticipants} players · locks {formatDeadline(room.deadline)} UTC
        </span>
        <div className="btn-row" style={{ gap: "0.4rem" }}>
          <Link className="btn primary" href={`/rooms/${room.id}`} style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem" }}>
            Open room
          </Link>
          <Link className="btn ghost" href={`/rooms/${room.id}/results`} style={{ padding: "0.4rem 0.75rem", fontSize: "0.75rem" }}>
            Results
          </Link>
        </div>
      </div>
    </article>
  );
}