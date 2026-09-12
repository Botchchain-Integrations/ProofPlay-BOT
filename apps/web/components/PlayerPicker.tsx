import type { Player } from "@proofplay/shared";

type PlayerPickerProps = {
  players: Player[];
  selectedIds?: number[];
  captainId?: number;
};

const positions: Array<Player["position"]> = ["GK", "DEF", "MID", "FWD"];

export function PlayerPicker({ players, selectedIds = [], captainId }: PlayerPickerProps) {
  if (players.length === 0) {
    return null;
  }

  return (
    <div className="glass-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Player Pool
        </h2>
        <span className="badge badge-green">Demo</span>
      </div>
      <p className="meta">Target formation: 1 GK, 1 DEF, 2 MID, 1 FWD + captain.</p>

      <div className="player-groups">
        {positions.map((position) => {
          const positionPlayers = players.filter((player) => player.position === position);

          if (positionPlayers.length === 0) {
            return null;
          }

          return (
            <section className="player-group" key={position}>
              <h3>{position}</h3>
              <div className="player-chip-wrap">
                {positionPlayers.map((player) => {
                  const selected = selectedIds.includes(player.id);
                  const captain = captainId === player.id;
                  const className = [
                    "player-chip",
                    selected ? "is-selected" : "",
                    captain ? "is-captain" : ""
                  ]
                    .join(" ")
                    .trim();

                  return (
                    <div className={className} key={player.id}>
                      <strong>{player.name}</strong>
                      <span>{player.team}</span>
                      {captain ? <em>Captain</em> : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}