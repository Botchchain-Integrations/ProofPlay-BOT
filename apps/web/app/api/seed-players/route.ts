import { successResponse, toRouteErrorResponse } from "@/lib/server/api-response";
import { HttpError } from "@/lib/server/http-error";
import { ensurePlayersSeeded } from "@/lib/server/services/seed-players.service";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    fixtureId?: unknown;
    homeTeam?: unknown;
    awayTeam?: unknown;
  } | null;

  const fixtureId = typeof body?.fixtureId === "string" ? body.fixtureId.trim() : "";
  const homeTeam = typeof body?.homeTeam === "string" ? body.homeTeam.trim() : "";
  const awayTeam = typeof body?.awayTeam === "string" ? body.awayTeam.trim() : "";

  if (!fixtureId || !homeTeam || !awayTeam) {
    return toRouteErrorResponse(
      new HttpError(400, "VALIDATION_ERROR", "fixtureId, homeTeam and awayTeam are required.")
    );
  }

  try {
    const result = await ensurePlayersSeeded({ fixtureId, homeTeam, awayTeam });
    return successResponse(result);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}