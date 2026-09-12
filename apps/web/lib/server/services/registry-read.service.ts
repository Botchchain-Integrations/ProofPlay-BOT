import { createPublicClient, http, type Address } from "viem";
import type { Player, PlayerPosition } from "@proofplay/shared";
import { botChain } from "@/lib/chains";
import { HttpError } from "../http-error";
import { fantasyMatchRoomAbi, playerRegistryAbi } from "@/lib/contracts";

// Reads the real on-chain player pool for a room contract address:
// room.matchId() -> registry.getMatchPlayerIds(matchId) -> getPlayer(...) per id.

const POSITION_FROM_ENUM: Record<number, PlayerPosition> = { 0: "GK", 1: "DEF", 2: "MID", 3: "FWD" };

export async function readOnChainPlayers(roomAddress: string): Promise<{ matchId: `0x${string}`; players: Player[] }> {
  const rpcUrl = process.env.NEXT_PUBLIC_BOT_RPC_URL;
  const publicClient = createPublicClient({
    chain: botChain,
    transport: http(rpcUrl)
  });

  const matchId = (await publicClient.readContract({
    abi: fantasyMatchRoomAbi,
    address: roomAddress as Address,
    functionName: "matchId",
    args: []
  })) as `0x${string}`;

  const playerIds = (await publicClient.readContract({
    abi: playerRegistryAbi,
    address: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address,
    functionName: "getMatchPlayerIds",
    args: [matchId]
  })) as bigint[];

  if (playerIds.length === 0) {
    return { matchId, players: [] };
  }

const players: Player[] = [];
  for (const playerId of playerIds) {
    const result = (await publicClient.readContract({
      abi: playerRegistryAbi,
      address: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS as Address,
      functionName: "getPlayer",
      args: [matchId, playerId]
    })) as { id: bigint; name: string; team: string; position: number; active: boolean; exists: boolean };
    const { id, name, team, position, active, exists } = result;

    if (!exists || !active) {
      continue;
    }

    players.push({
      id: Number(id),
      name,
      team,
      position: POSITION_FROM_ENUM[position] ?? "MID"
    });
  }

  return { matchId, players };
}