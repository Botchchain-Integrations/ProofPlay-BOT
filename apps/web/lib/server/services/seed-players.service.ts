import { createPublicClient, createWalletClient, http, keccak256, toBytes, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Player, PlayerPosition } from "@proofplay/shared";
import { botChain, botTestnet } from "@/lib/chains";
import { getContractAddresses } from "@/lib/contracts";
import { HttpError } from "../http-error";
import { createFootballProvider } from "../football-api";

// Server-only PlayerRegistry interaction used by the auto-seed route.
// Signs addPlayers() with the DEPLOYER_PRIVATE_KEY (the registry owner) so any
// live fixture can get its real starting-XI pool seeded on-chain on demand.

const POSITION_ENUM: Record<PlayerPosition, number> = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
const CHAINS: Record<number, Chain> = { [botChain.id]: botChain, [botTestnet.id]: botTestnet };

export const playerRegistryAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "getMatchPlayerIds",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256[]" }]
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "addPlayers",
    inputs: [
      { name: "matchId", type: "bytes32" },
      {
        name: "inputs",
        type: "tuple[]",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" },
          { name: "team", type: "string" },
          { name: "position", type: "uint8" }
        ]
      }
    ],
    outputs: []
  }
] as const;

export type SeedPlayersResult = {
  matchId: `0x${string}`;
  alreadySeeded: boolean;
  playerCount: number;
  txHash?: `0x${string}`;
};

function deployerKey(): `0x${string}` {
  const key = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!key) {
    throw new HttpError(503, "DEPLOYER_NOT_CONFIGURED", "DEPLOYER_PRIVATE_KEY is not configured.");
  }
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

export function resolveChain(chainId?: number) {
  return CHAINS[chainId ?? botChain.id] ?? botChain;
}

function deriveMatchId(fixtureId: string, homeTeam: string, awayTeam: string): `0x${string}` {
  return keccak256(toBytes(`${fixtureId}:${homeTeam}:${awayTeam}`));
}

// Ensures a match has a player pool on-chain. If players already exist for the
// derived matchId, returns `alreadySeeded: true` without spending gas. Otherwise
// fetches the real starting XIs from the football provider and seeds them.
export async function ensurePlayersSeeded(input: {
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  chainId?: number;
}): Promise<SeedPlayersResult> {
  const chain = resolveChain(input.chainId);
  const registry = getContractAddresses(chain.id).registry;
  const account = privateKeyToAccount(deployerKey());
  const matchId = deriveMatchId(input.fixtureId, input.homeTeam, input.awayTeam);

  const publicClient = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0])
  });

  const existing = (await publicClient.readContract({
    abi: playerRegistryAbi,
    address: registry,
    functionName: "getMatchPlayerIds",
    args: [matchId]
  })) as bigint[];

  if (existing.length > 0) {
    return { matchId, alreadySeeded: true, playerCount: existing.length };
  }

  const provider = createFootballProvider();
  if (!provider) {
    throw new HttpError(503, "FOOTBALL_API_NOT_CONFIGURED", "FOOTBALL_API_KEY is not configured.");
  }

  let players: Player[];
  try {
    players = await provider.getMatchPlayers(input.fixtureId);
  } catch (error) {
    throw new HttpError(
      502,
      "PLAYER_POOL_FETCH_FAILED",
      error instanceof Error ? error.message : `Failed to load player pool for fixture ${input.fixtureId}.`
    );
  }

  if (players.length === 0) {
    throw new HttpError(404, "PLAYER_POOL_EMPTY", `No player pool available for fixture ${input.fixtureId}.`);
  }

  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(chain.rpcUrls.default.http[0])
  });

  const inputs = players.map((player) => ({
    id: BigInt(player.id),
    name: player.name,
    team: player.team,
    position: POSITION_ENUM[player.position]
  }));

  const txHash = await walletClient.writeContract({
    abi: playerRegistryAbi,
    address: registry,
    functionName: "addPlayers",
    args: [matchId, inputs]
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status !== "success") {
    throw new HttpError(502, "PLAYER_SEED_TX_FAILED", "The player seeding transaction was reverted.");
  }

  return { matchId, alreadySeeded: false, playerCount: players.length, txHash };
}