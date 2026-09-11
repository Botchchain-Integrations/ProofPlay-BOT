import type { Match, Player, PlayerStats, PlayerPosition } from "@proofplay/shared";
import { HttpError } from "../http-error";
import type {
  FootballDataProvider,
  FootballMatch,
  FootballStatsResponse
} from "./types";
import { buildMatchKey } from "./types";

// APIfootball (apifootball.com) v3 via RapidAPI.
// Base: https://apiv3.apifootball.com/?action=...
// Requires FOOTBALL_API_KEY (server-side RapidAPI key, `x-rapidapi-key`).
//
// Free Basic plan (1,000 req/day, ~100/hr) covers the current season including
// line-ups, goal scorers and per-player match statistics - unlike the
// api-sports free tier, which is locked to past seasons.
//
// League ids: Premier League = 152, La Liga = 302.

const API_BASE = "https://apiv3.apifootball.com";
const API_HOST = "apiv3.apifootball.com";

export const COMPETITIONS = [
  { id: "152", name: "Premier League" },
  { id: "302", name: "La Liga" }
] as const;

function apiKey() {
  const key = process.env.FOOTBALL_API_KEY;
  if (!key) {
    throw new HttpError(503, "FOOTBALL_API_NOT_CONFIGURED", "FOOTBALL_API_KEY is not configured");
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
    },
    // APIfootball has no server-side cache header; be gentle with the free quota.
    cache: "no-store"
  });

  if (response.status === 401 || response.status === 403) {
    throw new HttpError(401, "FOOTBALL_API_AUTH_FAILED", "Football API authentication failed. Check FOOTBALL_API_KEY.");
  }
  if (response.status === 429) {
    throw new HttpError(429, "FOOTBALL_API_RATE_LIMITED", "Football API rate limit exceeded. Try again later.");
  }
  if (!response.ok) {
    throw new HttpError(502, "FOOTBALL_API_ERROR", `Football API returned ${response.status}`);
  }

  const body = (await response.json()) as { error?: number; message?: string };
  if (body && typeof body.error === "number") {
    throw new HttpError(502, "FOOTBALL_API_ERROR", `Football API error: ${body.message ?? body.error}`);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// APIfootball response shapes
// ---------------------------------------------------------------------------

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
  league_name: string;
  league_year?: string;
  match_date: string;
  match_time: string;
  match_status: string;
  match_hometeam_name: string;
  match_awayteam_name: string;
  match_hometeam_score?: string;
  match_awayteam_score?: string;
  lineup?: ApiLineup;
}

interface ApiPlayerStat {
  player_name: string;
  player_key: string;
  team_name: "home" | "away";
  player_position: string;
  player_is_subst: string;
  player_goals: string;
  player_goals_conceded: string;
  player_assists: string;
  player_yellowcards: string;
  player_redcards: string;
  player_minutes_played: string;
}

interface ApiTeamPlayer {
  player_key: string;
  player_name: string;
  player_type: string;
}

interface ApiTeam {
  team_name: string;
  players?: ApiTeamPlayer[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fixtureStatusToProof(status: string): Match["status"] {
  const s = status.toLowerCase();
  if (s.includes("finished") || s.includes("awarded")) return "finished";
  if (s.includes("live") || s.includes("half") || /^\d+'\s*$/.test(s.trim())) return "live";
  return "upcoming";
}

function mapPosition(position: string): PlayerPosition {
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

// Player_key -> position lookup for a league (used when a match has a lineup
// but no per-player statistics yet, e.g. an upcoming fixture).
const squadPositionCache = new Map<string, Map<string, string>>();

async function getSquadPositions(leagueId: string): Promise<Map<string, string>> {
  const cached = squadPositionCache.get(leagueId);
  if (cached) return cached;

  const teams = await apiGet<ApiTeam[]>({ action: "get_teams", league_id: leagueId });
  const map = new Map<string, string>();
  for (const team of teams) {
    for (const player of team.players ?? []) {
      map.set(String(player.player_key), player.player_type);
    }
  }
  squadPositionCache.set(leagueId, map);
  return map;
}

async function getEvent(matchId: string): Promise<ApiEvent> {
  const events = await apiGet<ApiEvent[]>({ action: "get_events", match_id: matchId, timezone: "UTC" });
  if (!Array.isArray(events) || events.length === 0) {
    throw new HttpError(404, "MATCH_NOT_FOUND", `No match found: ${matchId}`);
  }
  return events[0];
}

async function getPlayerStatistics(matchId: string): Promise<Map<string, ApiPlayerStat>> {
  const body = (await apiGet<Record<string, { player_statistics?: ApiPlayerStat[] }>>({
    action: "get_statistics",
    match_id: matchId
  })) as Record<string, { player_statistics?: ApiPlayerStat[] }>;

  const wrapped = Object.values(body ?? {})[0];
  const stats = wrapped?.player_statistics ?? [];
  const map = new Map<string, ApiPlayerStat>();
  for (const row of stats) {
    map.set(String(row.player_key), row);
  }
  return map;
}

interface PlayerPool {
  players: Player[];
  // keyed by the player_key used on-chain for seeding / settlement
  playerKeys: string[];
  homeTeamName: string;
  awayTeamName: string;
  homeConceded: number;
  awayConceded: number;
}

// Both getMatchPlayers and getMatchStats go through here so that the fantasy
// pool order (and therefore the on-chain player ids) is always identical.
// Pool = both starting XIs in lineup order; stats are attached by player_key.
async function getPlayerPool(matchId: string): Promise<PlayerPool> {
  const event = await getEvent(matchId);

  const lineup: ApiLineup | undefined = event.lineup;
  const starters = (side: keyof ApiLineup) => lineup?.[side]?.starting_lineups ?? [];

  const stats = await getPlayerStatistics(matchId);

  const leagueId = event.league_id;
  const positions = stats.size > 0 ? null : await getSquadPositions(leagueId);

  const rows: Array<ApiLineupPlayer & { team: string }> = [
    ...starters("home").map((p) => ({ ...p, team: event.match_hometeam_name })),
    ...starters("away").map((p) => ({ ...p, team: event.match_awayteam_name }))
  ];

  if (rows.length === 0) {
    throw new HttpError(404, "MATCH_NOT_FOUND", `No lineup data for match: ${matchId}`);
  }

  const players: Player[] = [];
  const playerKeys: string[] = [];

  rows.forEach((entry, index) => {
    const stat = stats.get(String(entry.player_key));
    const position = stat ? mapPosition(stat.player_position) : mapPosition(positions?.get(String(entry.player_key)) ?? "");

    playerKeys.push(String(entry.player_key));
    players.push({
      id: index + 1, // on-chain registry index: 1-based, stable across calls
      name: entry.lineup_player,
      team: entry.team,
      position,
      imageUrl: undefined
    });
  });

  return {
    players,
    playerKeys,
    homeTeamName: event.match_hometeam_name,
    awayTeamName: event.match_awayteam_name,
    homeConceded: toInt(event.match_awayteam_score),
    awayConceded: toInt(event.match_hometeam_score)
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class ApiFootballProvider implements FootballDataProvider {
  async listMatches(): Promise<FootballMatch[]> {
    const now = new Date();
    const from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const results: FootballMatch[] = [];

    for (const competition of COMPETITIONS) {
      const events = await apiGet<ApiEvent[]>({
        action: "get_events",
        league_id: competition.id,
        from: fromStr,
        to: toStr,
        timezone: "UTC"
      });

      if (!Array.isArray(events)) continue;

      for (const event of events) {
        const homeTeam = event.match_hometeam_name;
        const awayTeam = event.match_awayteam_name;
        const fixtureId = String(event.match_id);
        results.push({
          id: fixtureId,
          fixtureId,
          matchKey: buildMatchKey(fixtureId, homeTeam, awayTeam),
          homeTeam,
          awayTeam,
          kickoffTime: `${event.match_date}T${event.match_time}:00Z`,
          status: fixtureStatusToProof(event.match_status),
          competition: event.league_name || competition.name,
          season: event.league_year ?? ""
        });
      }
    }

    results.sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));
    return results;
  }

  async getMatchPlayers(matchId: string): Promise<Player[]> {
    const pool = await getPlayerPool(matchId);
    return pool.players;
  }

  async getMatchStats(matchId: string): Promise<FootballStatsResponse> {
    const pool = await getPlayerPool(matchId);
    const stats = await getPlayerStatistics(matchId);

    const players: PlayerStats[] = pool.players.map((player, index) => {
      const row = stats.get(String(pool.playerKeys[index]));
      const teamConceded = player.team === pool.homeTeamName ? pool.homeConceded : pool.awayConceded;
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
      matchId,
      source: "apifootball",
      players
    };
  }
}