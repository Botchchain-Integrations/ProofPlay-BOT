import type { Match, Player, PlayerStats } from "@proofplay/shared";
import { HttpError } from "../http-error";
import { createFootballProvider } from "../football-api";
import type { FootballMatch } from "../football-api/types";

const DEMO_MATCHES: Match[] = [
  {
    id: "ars-che-2026-05-24",
    homeTeam: "Arsenal",
    awayTeam: "Chelsea",
    kickoffTime: "2026-05-24T16:30:00Z",
    status: "finished"
  }
];

const DEMO_PLAYERS_BY_MATCH: Record<string, Player[]> = {
  "ars-che-2026-05-24": [
    { id: 1, name: "David Raya", team: "Arsenal", position: "GK" },
    { id: 2, name: "William Saliba", team: "Arsenal", position: "DEF" },
    { id: 3, name: "Martin Odegaard", team: "Arsenal", position: "MID" },
    { id: 4, name: "Cole Palmer", team: "Chelsea", position: "MID" },
    { id: 5, name: "Nicolas Jackson", team: "Chelsea", position: "FWD" }
  ]
};

const DEMO_STATS_BY_MATCH: Record<string, PlayerStats[]> = {
  "ars-che-2026-05-24": [
    { playerId: 1, goals: 0, assists: 0, yellowCards: 0, redCards: 0, cleanSheet: true, minutesPlayed: 90 },
    { playerId: 2, goals: 0, assists: 1, yellowCards: 0, redCards: 0, cleanSheet: true, minutesPlayed: 90 },
    { playerId: 3, goals: 1, assists: 0, yellowCards: 1, redCards: 0, cleanSheet: false, minutesPlayed: 88 },
    { playerId: 4, goals: 1, assists: 0, yellowCards: 0, redCards: 0, cleanSheet: false, minutesPlayed: 90 },
    { playerId: 5, goals: 0, assists: 0, yellowCards: 1, redCards: 0, cleanSheet: false, minutesPlayed: 76 }
  ]
};

function isMatchIdOfMappedFixture(matchId: string) {
  return matchId === DEMO_MATCHES[0]?.id;
}

export async function listMatches() {
  const provider = createFootballProvider();

  if (provider) {
    try {
      const matches = await provider.listMatches();
      if (matches.length > 0) {
        return matches as Match[];
      }
      // fall through if the live provider returned no fixtures
    } catch {
      // fall back to demo fixtures on provider failure so the UI stays usable
    }
  }

  return DEMO_MATCHES;
}

export async function listFootballMatches(): Promise<FootballMatch[]> {
  const provider = createFootballProvider();

  if (!provider) {
    return [];
  }

  return provider.listMatches();
}

export async function getMatchPlayers(matchId: string) {
  const provider = createFootballProvider();

  if (provider) {
    try {
      return await provider.getMatchPlayers(matchId);
    } catch (error) {
      if (!isMatchIdOfMappedFixture(matchId)) {
        throw error;
      }
    }
  }

  const players = DEMO_PLAYERS_BY_MATCH[matchId];
  if (!players) {
    throw new HttpError(404, "MATCH_NOT_FOUND", `No players found for match: ${matchId}`);
  }
  return players;
}

export async function getMatchStats(matchId: string) {
  const provider = createFootballProvider();

  if (provider) {
    try {
      return await provider.getMatchStats(matchId);
    } catch (error) {
      if (!isMatchIdOfMappedFixture(matchId)) {
        throw error;
      }
    }
  }

  const players = DEMO_STATS_BY_MATCH[matchId];
  if (!players) {
    throw new HttpError(404, "MATCH_NOT_FOUND", `No stats found for match: ${matchId}`);
  }
  return {
    matchId,
    source: "demo" as const,
    players
  };
}