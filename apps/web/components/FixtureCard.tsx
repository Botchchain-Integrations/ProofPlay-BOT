import Link from "next/link";
import { CountdownTimer } from "@/components/CountdownTimer";
import { TeamEmblem } from "@/components/TeamEmblem";

type FixtureCardProps = {
  id: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  roomCount?: number;
  variant?: "hero" | "default";
};

function StatusBadge({ status, startDate }: { status: string; startDate: string }) {
  if (status === "live") {
    return (
      <span className="status-pill status-pill--live">
        <span className="status-dot" aria-hidden="true" />
        Live
      </span>
    );
  }

  if (status === "finished") {
    return (
      <span className="status-pill status-pill--final">
        <span className="status-dot" aria-hidden="true" />
        Final
      </span>
    );
  }

  return (
    <span className="countdown-label">
      <CountdownTimer targetDate={startDate} />
    </span>
  );
}

export function FixtureCard({
  id,
  homeTeam,
  awayTeam,
  kickoffTime,
  status,
  homeScore,
  awayScore,
  roomCount = 0,
  variant = "default"
}: FixtureCardProps) {
  const isLive = status === "live";
  const isFinished = status === "finished";
  const isUpcoming = status === "upcoming" || status === "scheduled";
  const showScore = isLive || isFinished;

  if (variant === "hero") {
    return (
      <Link href={`/rooms/create?match=${id}`}>
        <div className="glass-card">
          <div className="fixture-hero" style={{ padding: "1.25rem 1.25rem 0" }}>
            <div className="fixture-team">
              <TeamEmblem name={homeTeam} size="lg" />
              <span>{homeTeam}</span>
            </div>

            <div className="fixture-center">
              {showScore ? (
                <span className="fixture-score">
                  {homeScore ?? 0} - {awayScore ?? 0}
                </span>
              ) : (
                <span className="fixture-vs">vs</span>
              )}
              <StatusBadge status={status} startDate={kickoffTime} />
            </div>

            <div className="fixture-team">
              <TeamEmblem name={awayTeam} size="lg" />
              <span>{awayTeam}</span>
            </div>
          </div>

          <div
            className="fixture-row"
            style={{
              justifyContent: "space-between",
              padding: "0.9rem 1.25rem 1.1rem",
              borderTop: "1px solid rgba(255,255,255,0.06)",
              marginTop: "1.1rem"
            }}
          >
            <span className="meta" style={{ fontSize: "0.75rem" }}>
              {roomCount} fantasy rooms
            </span>
            <span className="arrow-link" style={{ opacity: 1 }}>
              {isUpcoming ? "Start a room →" : isLive ? "View match →" : "View receipts →"}
            </span>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/rooms/create?match=${id}`}>
      <div className="glass-card fixture-row" style={{ padding: "0.9rem 1rem" }}>
        <div className="fixture-row__team home-team" style={{ flex: 1 }}>
          <TeamEmblem name={homeTeam} />
          <span>{homeTeam}</span>
        </div>

        <div className="fixture-row__center">
          {showScore ? (
            <span className="mono" style={{ fontSize: "0.875rem", fontWeight: 700 }}>
              {homeScore ?? 0} - {awayScore ?? 0}
            </span>
          ) : (
            <span style={{ fontSize: "0.75rem", color: "var(--zinc-500)" }}>vs</span>
          )}
          <StatusBadge status={status} startDate={kickoffTime} />
        </div>

        <div className="fixture-row__team away-team" style={{ flex: 1 }}>
          <span>{awayTeam}</span>
          <TeamEmblem name={awayTeam} />
        </div>

        <span
          className="badge"
          style={{
            flexShrink: 0,
            ...(isUpcoming
              ? { background: "rgba(34,197,94,0.1)", color: "var(--green)" }
              : isLive
                ? { background: "rgba(239,68,68,0.1)", color: "var(--red)" }
                : { background: "rgba(113,113,122,0.1)", color: "var(--zinc-500)" })
          }}
        >
          {isUpcoming ? "Create Room" : isLive ? "View Match" : "Receipts"}
        </span>
      </div>
    </Link>
  );
}