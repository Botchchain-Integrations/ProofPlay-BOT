import { ethers } from "hardhat";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

// Live PlayerRegistry seeding for a real APIfootball fixture.
//
// Replicates the provider pool logic in apps/web/lib/server/football-api/
// so on-chain player ids always match what the frontend displays:
//   - pool = home starting XI (lineup order) then away starting XI
//   - ids are 1-based indexes into that pool
//   - positions come from get_statistics (fallback: squad lookup via get_teams)
//
// Also writes contracts/data/match-<fixtureId>.json with the normalized,
// final-match stats so mock-settle-room.ts can settle the room with the same
// numbers the frontend would show.

const API_BASE = "https://apiv3.apifootball.com";
const API_HOST = "apiv3.apifootball.com";

const POSITION_ENUM: Record<string, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

interface ApiTeamPlayer {
  player_key?: string;
  player_name?: string;
  player_type?: string;
}

interface ApiTeam {
  team_name?: string;
  players?: ApiTeamPlayer[];
}

interface ApiLineupPlayer {
  lineup_player: string;
  lineup_number: string;
  lineup_position: string;
  player_key: string;
}

interface ApiLineup {
  home: { starting_lineups: ApiLineupPlayer[]; substitutes: ApiLineupPlayer[] };
  away: { starting_lineups: ApiLineupPlayer[]; substitutes: ApiLineupPlayer[] };
}

interface ApiEvent {
  match_id: string;
  league_id: string;
  match_hometeam_name: string;
  match_awayteam_name: string;
  match_hometeam_score?: string;
  match_awayteam_score?: string;
  lineup?: ApiLineup;
}

interface ApiStatRow {
  player_key: string;
  player_position: string;
  player_goals: string;
  player_assists: string;
  player_yellowcards: string;
  player_redcards: string;
  player_minutes_played: string;
}

interface PoolRow {
  name: string;
  team: string;
  position: string;
  playerKey: string;
}

interface SeedStat {
  playerId: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  cleanSheet: boolean;
  minutesPlayed: number;
}

function apiKey(): string {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) {
    throw new Error("Set FOOTBALL_API_KEY to run live seeding.");
  }
  return key;
}

async function apiGet<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(API_BASE);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": apiKey(),
      "x-rapidapi-host": API_HOST
    }
  });

  if (!response.ok) {
    throw new Error(`Football API returned ${response.status}`);
  }

  const body = (await response.json()) as { error?: number; message?: string };
  if (body && typeof body.error === "number") {
    throw new Error(`Football API error: ${body.message ?? body.error}`);
  }
  return body as T;
}

function mapPosition(position: string): string {
  const p = position.toLowerCase();
  if (p.includes("goalkeeper") || p === "g" || p === "gk") return "GK";
  if (p.includes("defender") || p === "d") return "DEF";
  if (p.includes("midfield") || p === "m") return "MID";
  if (p.includes("forward") || p.includes("attack") || p === "f") return "FWD";
  return "MID";
}

function toInt(value: string | undefined): number {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

// Same resolution as the web provider: prefer the per-match statistic
// position, fall back to the league squad position lookup.
function resolvePosition(
  statsMap: Map<string, ApiStatRow>,
  squadPositions: Map<string, string> | null,
  player: ApiLineupPlayer
): string {
  const stat = statsMap.get(String(player.player_key));
  if (stat) {
    return mapPosition(stat.player_position);
  }
  return mapPosition(squadPositions?.get(String(player.player_key)) ?? "");
}

async function getSquadPositions(leagueId: string): Promise<Map<string, string>> {
  const teams = await apiGet<ApiTeam[]>({ action: "get_teams", league_id: leagueId });
  const map = new Map<string, string>();
  for (const team of teams) {
    for (const player of team.players ?? []) {
      map.set(String(player.player_key), String(player.player_type));
    }
  }
  return map;
}

async function loadFixture(fixtureId: string): Promise<{
  matchKey: string;
  homeTeam: string;
  awayTeam: string;
  players: PoolRow[];
  stats: SeedStat[];
}> {
  const events = await apiGet<ApiEvent[]>({
    action: "get_events",
    match_id: fixtureId,
    timezone: "UTC"
  });

  if (!Array.isArray(events) || events.length === 0) {
    throw new Error(`No fixture found: ${fixtureId}`);
  }

  const event = events[0];
  const starters = (side: "home" | "away") => event.lineup?.[side]?.starting_lineups ?? [];

  const statsBody = (await apiGet<Record<string, { player_statistics?: ApiStatRow[] }>>({
    action: "get_statistics",
    match_id: fixtureId
  })) as Record<string, { player_statistics?: ApiStatRow[] }>;

  const wrapped = Object.values(statsBody ?? {})[0];
  const statsRows = wrapped?.player_statistics ?? [];
  const statsMap = new Map<string, ApiStatRow>();
  for (const row of statsRows) {
    statsMap.set(String(row.player_key), row);
  }

  const leagueId = event.league_id;
  const positions = statsMap.size > 0 ? null : await getSquadPositions(leagueId);

  const rows: Array<{ name: string; team: string; position: string; playerKey: string }> = [
    ...starters("home").map((p) => ({
      name: p.lineup_player,
      team: event.match_hometeam_name,
      position: resolvePosition(statsMap, positions, p),
      playerKey: String(p.player_key)
    })),
    ...starters("away").map((p) => ({
      name: p.lineup_player,
      team: event.match_awayteam_name,
      position: resolvePosition(statsMap, positions, p),
      playerKey: String(p.player_key)
    }))
  ];

  if (rows.length === 0) {
    throw new Error(`No lineup data for fixture: ${fixtureId}`);
  }

  const players: PoolRow[] = rows;

  const homeConceded = toInt(event.match_awayteam_score);
  const awayConceded = toInt(event.match_hometeam_score);

  const stats: SeedStat[] = players.map((player, index) => {
    const row = statsMap.get(player.playerKey);
    const teamConceded = player.team === event.match_hometeam_name ? homeConceded : awayConceded;
    const isDefensive = player.position === "GK" || player.position === "DEF";

    return {
      playerId: index + 1,
      goals: toInt(row?.player_goals),
      assists: toInt(row?.player_assists),
      yellowCards: toInt(row?.player_yellowcards),
      redCards: toInt(row?.player_redcards),
      cleanSheet: Boolean(row) && teamConceded === 0 && isDefensive,
      minutesPlayed: toInt(row?.player_minutes_played)
    };
  });

  return {
    matchKey: `${fixtureId}:${event.match_hometeam_name}:${event.match_awayteam_name}`,
    homeTeam: event.match_hometeam_name,
    awayTeam: event.match_awayteam_name,
    players,
    stats
  };
}

async function main() {
  const registryAddress = process.env.REGISTRY_ADDRESS;

  if (!registryAddress || !ethers.isAddress(registryAddress)) {
    throw new Error("Set REGISTRY_ADDRESS to a valid PlayerRegistry contract address.");
  }

  const fixtureId = process.env.FIXTURE_ID ?? "812679";
  const fixture = await loadFixture(fixtureId);

  const matchId = ethers.keccak256(ethers.toUtf8Bytes(fixture.matchKey));
  const registry = await ethers.getContractAt("PlayerRegistry", registryAddress);

  const dataDir = path.join(__dirname, "..", "data");
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(
    path.join(dataDir, `match-${fixtureId}.json`),
    JSON.stringify(
      {
        fixtureId,
        matchKey: fixture.matchKey,
        matchId,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        players: fixture.players.map((player, index) => ({
          id: index + 1,
          name: player.name,
          team: player.team,
          position: player.position
        })),
        stats: fixture.stats
      },
      null,
      2
    ),
    "utf8"
  );

  const existingPlayerIds: bigint[] = await registry.getMatchPlayerIds(matchId);

  if (existingPlayerIds.length > 0) {
    console.log("Players already seeded for this match.");
  } else {
    const inputs = fixture.players.map((player, index) => ({
      id: BigInt(index + 1),
      name: player.name,
      team: player.team,
      position: POSITION_ENUM[player.position] ?? 2
    }));

    const addPlayersTx = await registry.addPlayers(matchId, inputs);
    await addPlayersTx.wait();

    console.log(`Seeded ${inputs.length} players into PlayerRegistry on BOT Chain Testnet.`);
  }

  console.log("matchKey:", fixture.matchKey);
  console.log("matchId:", matchId);
  console.log("registry:", registryAddress);
  console.log(`snapshot: contracts/data/match-${fixtureId}.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});