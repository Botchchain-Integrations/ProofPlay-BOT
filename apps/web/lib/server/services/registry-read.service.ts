import { createPublicClient, http, type Address, type Chain } from "viem";
import type { Player, PlayerPosition } from "@proofplay/shared";
import { botChain, botTestnet } from "@/lib/chains";
import { HttpError } from "../http-error";
import { fantasyMatchRoomAbi, playerRegistryAbi, getContractAddresses } from "@/lib/contracts";

// Reads the real on-chain player pool for a room contract address:
// room.matchId() -> registry.getMatchPlayerIds(matchId) -> getPlayer(...) per id.

const POSITION_FROM_ENUM: Record<number, PlayerPosition> = { 0: "GK", 1: "DEF", 2: "MID", 3: "FWD" };
const CHAINS: Record<number, Chain> = { [botChain.id]: botChain, [botTestnet.id]: botTestnet };

export async function readOnChainPlayers(
  roomAddress: string,
  chainId: number = botChain.id
): Promise<{ matchId: `0x${string}`; players: Player[] }> {
  const chain = CHAINS[chainId] ?? botChain;
  const rpcUrl = process.env.NEXT_PUBLIC_BOT_RPC_URL ?? chain.rpcUrls.default.http[0];
  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl)
  });
  const registry = getContractAddresses(chain.id).registry;
  if (!registry) {
    throw new HttpError(503, "REGISTRY_NOT_CONFIGURED", "Registry address is not configured.");
  }

  const matchId = (await publicClient.readContract({
    abi: fantasyMatchRoomAbi,
    address: roomAddress as Address,
    functionName: "matchId",
    args: []
  })) as `0x${string}`;

  const playerIds = (await publicClient.readContract({
    abi: playerRegistryAbi,
    address: registry,
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
      address: registry,
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