import type { DemoLeaderboardEntry } from "@/lib/demo-data";

type LeaderboardProps = {
  entries: DemoLeaderboardEntry[];
};

export function Leaderboard({ entries }: LeaderboardProps) {
  return (
    <div className="glass-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.9rem" }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Leaderboard
        </h2>
        <span className="badge badge-green">{entries.length} teams</span>
      </div>

      {entries.length === 0 ? (
        <p className="meta">No lineups submitted yet.</p>
      ) : (
        <div className="leaderboard-list">
          {entries.map((entry, index) => (
            <div className={`leaderboard-row ${entry.winner ? "is-winner" : ""}`} key={entry.teamName}>
              <span>
                <span className="leaderboard-rank">#{index + 1}</span>
                {entry.teamName}
              </span>
              <span className="leaderboard-points">
                {entry.points} <em>pts</em>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}