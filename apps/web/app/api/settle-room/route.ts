import { isAddress } from "viem";
import { successResponse, toRouteErrorResponse } from "@/lib/server/api-response";
import { HttpError } from "@/lib/server/http-error";
import { claimRoomPrize, settleRoom } from "@/lib/server/services/settle-room.service";

// POST /api/settle-room
// body: { roomAddress, fixtureId, chainId?, action?: "settle" | "claim" }
//
// settle: locks (if needed) and submits the provider's final stats through
// onAgentResponse, which is creator-only, so DEPLOYER_PRIVATE_KEY must be the
// room creator's key. The contract then scores every lineup on-chain.
// claim: pays the recorded winner (winner-only, so again the creator key only
// works when the creator also won).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    roomAddress?: unknown;
    fixtureId?: unknown;
    chainId?: unknown;
    action?: unknown;
  } | null;

  const roomAddress = typeof body?.roomAddress === "string" ? body.roomAddress.trim() : "";
  const action = body?.action === "claim" ? "claim" : "settle";

  if (!roomAddress || !isAddress(roomAddress)) {
    return toRouteErrorResponse(
      new HttpError(400, "VALIDATION_ERROR", "roomAddress must be a valid room contract address.")
    );
  }

  const fixtureId = typeof body?.fixtureId === "string" ? body.fixtureId.trim() : "";
  const chainId = typeof body?.chainId === "number" ? body.chainId : undefined;

  if (action === "settle" && !fixtureId) {
    return toRouteErrorResponse(
      new HttpError(400, "VALIDATION_ERROR", "fixtureId is required to read final match stats.")
    );
  }

  try {
    const result =
      action === "claim"
        ? await claimRoomPrize({ roomAddress, chainId })
        : await settleRoom({ roomAddress, fixtureId, chainId });
    return successResponse(result);
  } catch (error) {
    return toRouteErrorResponse(error);
  }
}