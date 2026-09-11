import { ApiFootballProvider } from "./api-football";
import type { FootballDataProvider } from "./types";

// Factory: returns a live provider when a key is configured, otherwise null
// so callers can fall back to demo fixtures (offline / unconfigured).
export function createFootballProvider(): FootballDataProvider | null {
  if (process.env.FOOTBALL_API_KEY) {
    return new ApiFootballProvider();
  }
  return null;
}