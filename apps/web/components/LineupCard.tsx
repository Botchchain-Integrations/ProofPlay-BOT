import type { Player } from "@proofplay/shared";
import type { DemoLineup } from "@/lib/demo-data";

type LineupCardProps = {
  lineup: DemoLineup;
  players: Player[];
};

function resolvePlayerName(playerId: number, players: Player[]) {
  const player = players.find((item) => item.id === playerId);
  return player ? `${player.name} (${player.position})` : `Player ${playerId}`;
}

export function LineupCard({ lineup, players }: LineupCardProps) {
  return (
    <div className="glass-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <div>
          <h2 className="section-title" style={{ margin: 0 }}>
            Saved Lineup
          </h2>
          <p className="meta" style={{ marginTop: "0.2rem", fontSize: "0.75rem" }}>
            {lineup.teamName}
          </p>
        </div>
        <span className="badge badge-green">Demo</span>
      </div>

      <div className="lineup-list">
        {lineup.playerIds.map((playerId) => {
          const isCaptain = lineup.captainId === playerId;
          const player = players.find((item) => item.id === playerId);
          const pointsMeta = player ? `${player.team} · ${player.position}` : `Player ${playerId}`;

          return (
            <div className="lineup-row" key={playerId}>
              <span>
                {resolvePlayerName(playerId, players)}
                <span className="mono"> · {pointsMeta}</span>
              </span>
              {isCaptain ? (
                <span className="pill status-pill--claimable" style={{ textTransform: "uppercase", fontSize: "0.6875rem" }}>
                  Captain
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}