import type { Match, Player, PlayerStats, PlayerPosition } from "@proofplay/shared";
import { HttpError } from "../http-error";
import type {
  FootballDataProvider,
  FootballMatch,
  FootballStatsResponse
} from "./types";
import { buildMatchKey } from "./types";

// APIfootball v3. FOOTBALL_API_KEY is a server-side key.
//
// The provider is host-agnostic so the same key works on either endpoint:
//   1. RapidAPI: https://apifootball3.p.rapidapi.com/?action=...
//      key sent via the `x-rapidapi-key` / `x-rapidapi-host` headers.
//   2. Direct APIfootball: https://apiv3.apifootball.com/?action=...
//      key sent via the `APIkey` query parameter.
// Each call tries RapidAPI first and falls back to the direct host, so a key
// issued on either platform works without configuration changes.
//
// Free Basic plan (1,000 req/day, ~100/hr) covers the current season including
// line-ups, goal scorers and per-player match statistics - unlike the
// api-sports free tier, which is locked to past seasons.
//
// League ids: Premier League = 152, La Liga = 302.

const RAPID_BASE = "https://apifootball3.p.rapidapi.com/";
const RAPID_HOST = "apifootball3.p.rapidapi.com";
const DIRECT_BASE = "https://apiv3.apifootball.com/";

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

async function apiGetOnce<T>(params: Record<string, string>): Promise<T> {
  const key = apiKey();
  const url = new URL(RAPID_BASE);
  for (const [param, value] of Object.entries(params)) {
    url.searchParams.set(param, value);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "x-rapidapi-key": key,
      "x-rapidapi-host": RAPID_HOST
    },
    // APIfootball has no server-side cache header; be gentle with the free quota.
    cache: "no-store"
  });

  return parseApiResponse<T>(response);
}

async function apiGetDirect<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(DIRECT_BASE);
  for (const [param, value] of Object.entries(params)) {
    url.searchParams.set(param, value);
  }
  url.searchParams.set("APIkey", apiKey());

  const response = await fetch(url.toString(), {
    cache: "no-store"
  });

  return parseApiResponse<T>(response);
}

async function parseApiResponse<T>(response: Response): Promise<T> {
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

async function apiGet<T>(params: Record<string, string>): Promise<T> {
  let rapidError: unknown;
  try {
    return await apiGetOnce<T>(params);
  } catch (error) {
    rapidError = error;
  }
  try {
    return await apiGetDirect<T>(params);
  } catch {
    // both hosts failed: surface the RapidAPI failure, which is the primary path
    throw rapidError;
  }
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

interface ApiLeague {
  country_id: string;
  country_name: string;
  league_id: string;
  league_name: string;
  league_season?: string;
  league_logo?: string;
  country_logo?: string;
}

// ---------------------------------------------------------------------------
// League discovery
// ---------------------------------------------------------------------------

// The APIfootball free/basic plans only cover a subset of leagues. `get_leagues`
// returns the competitions included in the current subscription, so fixtures are
// requested from what the plan actually covers instead of hardcoded ids that
// return "No event found (please check your plan)!". Cached briefly to keep the
// get_events quota usage low.
const coveredLeaguesCache: { at: number; leagues: ApiLeague[] } = { at: 0, leagues: [] };
const COVERED_LEAGUES_TTL_MS = 15 * 60 * 1000;

async function getCoveredLeagues(): Promise<ApiLeague[]> {
  if (coveredLeaguesCache.leagues.length > 0 && Date.now() - coveredLeaguesCache.at < COVERED_LEAGUES_TTL_MS) {
    return coveredLeaguesCache.leagues;
  }

  const body = await apiGet<ApiLeague[]>({ action: "get_leagues" });
  const seen = new Set<string>();
  const leagues: ApiLeague[] = [];
  for (const league of Array.isArray(body) ? body : []) {
    if (league?.league_id && !seen.has(league.league_id)) {
      seen.add(league.league_id);
      leagues.push(league);
    }
  }

  coveredLeaguesCache.at = Date.now();
  coveredLeaguesCache.leagues = leagues;
  return leagues;
}

const PREFERRED_LEAGUE_PATTERN =
  /premier league|la liga|primera divis|serie a|bundesliga|ligue 1|eredivisie/i;

function pickFixturesLeagues(covered: ApiLeague[]): ApiLeague[] {
  const exactIds = new Set<string>(COMPETITIONS.map((competition) => competition.id));
  const picked = covered.filter((league) => exactIds.has(league.league_id));
  if (picked.length > 0) {
    return picked;
  }

  // Preferred ids are not in this plan: fall back to any top-flight competition
  // the plan covers so the feed still returns real fixtures.
  const named = covered.filter((league) => PREFERRED_LEAGUE_PATTERN.test(league.league_name));
  if (named.length > 0) {
    return named.slice(0, COMPETITIONS.length);
  }

  return covered.slice(0, COMPETITIONS.length);
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

async function getSquadPlayers(leagueId: string): Promise<ApiTeam[]> {
  return apiGet<ApiTeam[]>({ action: "get_teams", league_id: leagueId });
}

function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\butd\b/g, "united")
    .replace(/\bath\b/g, "athletic")
    .replace(/\bdep\.?\b/g, "deportivo")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(afc|fc)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function teamNamesMatch(fixtureName: string, squadName: string): boolean {
  const fixture = normalizeTeamName(fixtureName);
  const squad = normalizeTeamName(squadName);
  if (fixture === squad) return true;
  return fixture.startsWith(`${squad} `) || squad.startsWith(`${fixture} `);
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

// Per-fixture pool cache. Building a pool costs up to 4 APIfootball calls
// (get_events + get_statistics ± get_teams). Rapid create-room clicks across
// several fixtures exhaust the free hourly quota and surface as 502 rate-limit
// errors, so cache each built pool so repeated and duplicate requests reuse it.
const poolCache = new Map<string, { at: number; pool: PlayerPool }>();
const POOL_TTL_MS = 60 * 60 * 1000;

async function getPlayerPool(matchId: string): Promise<PlayerPool> {
  const cached = poolCache.get(matchId);
  if (cached && Date.now() - cached.at < POOL_TTL_MS) {
    return cached.pool;
  }

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

  // Upcoming fixtures often have no starting XI yet. Use the current squad
  // roster as a stable player pool so rooms can be created before kickoff.
  if (rows.length === 0) {
    const squads = await getSquadPlayers(leagueId);
    for (const squad of squads) {
      const teamName = [event.match_hometeam_name, event.match_awayteam_name].find((fixtureName) =>
        teamNamesMatch(fixtureName, squad.team_name)
      );
      if (!teamName) continue;
      for (const player of squad.players ?? []) {
        rows.push({
          lineup_player: player.player_name,
          lineup_number: "",
          lineup_position: player.player_type,
          player_key: player.player_key,
          team: teamName
        });
      }
    }
  }

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

  const pool: PlayerPool = {
    players,
    playerKeys,
    homeTeamName: event.match_hometeam_name,
    awayTeamName: event.match_awayteam_name,
    homeConceded: toInt(event.match_awayteam_score),
    awayConceded: toInt(event.match_hometeam_score)
  };

  poolCache.set(matchId, { at: Date.now(), pool });
  return pool;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

// Module-cached fixture list. The free plan has a strict hourly quota, so the
// feed is recomputed at most once per TTL instead of on every page request.
const listMatchesCache: { at: number; matches: FootballMatch[] } = { at: 0, matches: [] };
const LIST_MATCHES_TTL_MS = 15 * 60 * 1000;

export class ApiFootballProvider implements FootballDataProvider {
  async listMatches(): Promise<FootballMatch[]> {
    if (listMatchesCache.matches.length > 0 && Date.now() - listMatchesCache.at < LIST_MATCHES_TTL_MS) {
      return listMatchesCache.matches;
    }

    const now = new Date();
    const from = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);

    const results: FootballMatch[] = [];

    const pushEvents = (events: ApiEvent[], fallbackName?: string) => {
      if (!Array.isArray(events)) return;
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
          competition: event.league_name || fallbackName || "",
          season: event.league_year ?? ""
        });
      }
    };

    // Preferred path: fetch every covered league's events in one windowed call.
    // Some plans only return a limited league set without a league_id filter,
    // so treat this as best-effort.
    try {
      pushEvents(await apiGet<ApiEvent[]>({ action: "get_events", from: fromStr, to: toStr, timezone: "UTC" }));
    } catch (error) {
      console.error("[football] broad get_events failed:", error instanceof Error ? error.message : error);
    }

    // If the broad call produced nothing, scan plan-covered leagues individually
    // and stop at the first league that yields fixtures.
    if (results.length === 0) {
      const coveredLeagues = await getCoveredLeagues();
      const fixturesLeagues = pickFixturesLeagues(coveredLeagues);
      console.error(
        `[football] covered=${coveredLeagues.length} candidates=${fixturesLeagues
          .map((league) => `${league.league_id}:${league.league_name}`)
          .join(",")}`
      );

      for (const league of fixturesLeagues.slice(0, 12)) {
        try {
          const events = await apiGet<ApiEvent[]>({
            action: "get_events",
            league_id: league.league_id,
            from: fromStr,
            to: toStr,
            timezone: "UTC"
          });
          pushEvents(events, league.league_name);
          if (results.length > 0) break;
        } catch (error) {
          console.error(
            `[football] get_events failed for ${league.league_id}:${league.league_name}:`,
            error instanceof Error ? error.message : error
          );
        }
      }
    }

    results.sort((a, b) => a.kickoffTime.localeCompare(b.kickoffTime));
    listMatchesCache.at = Date.now();
    listMatchesCache.matches = results;
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
