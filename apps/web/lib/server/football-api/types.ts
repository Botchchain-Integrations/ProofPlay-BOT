import type { Match, Player, PlayerStats } from "@proofplay/shared";

// A live match with its football-provider identifier. The provider is
// swappable - the rest of the app only relies on these normalized shapes.
export interface FootballMatch extends Match {
  // Stable external match id assigned by the football data provider
  // (e.g. API-Football fixture id). Stored alongside the ProofPlay match
  // so team name + date ambiguity is avoided.
  fixtureId: string;
  matchKey: string;
  competition: string;
  season: string;
}

export interface FootballPlayerResponse {
  matchId: string;
  players: Player[];
}

export interface FootballStatsResponse {
  matchId: string;
  source: string;
  players: PlayerStats[];
}

export interface FootballDataProvider {
  // Upcoming + recently finished matches for the configured competitions.
  listMatches(): Promise<FootballMatch[]>;
  // Players available for a given match id (the fantasy pick pool).
  getMatchPlayers(matchId: string): Promise<Player[]>;
  // Final per-player statistics for scoring / settlement.
  getMatchStats(matchId: string): Promise<FootballStatsResponse>;
}

// helper to build a ProofPlay match key the same way the create-room page
// and PlayerRegistry seeding use it: `${id}:${home}:${away}`
export function buildMatchKey(fixtureId: string, homeTeam: string, awayTeam: string) {
  return `${fixtureId}:${homeTeam}:${awayTeam}`;
}