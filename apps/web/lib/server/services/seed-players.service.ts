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

function formatBot(wei: bigint): string {
  const value = Number(wei) / 1e18;
  return value >= 100 ? value.toFixed(0) : value.toFixed(4);
}

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

  let existing: bigint[];
  try {
    existing = (await publicClient.readContract({
      abi: playerRegistryAbi,
      address: registry,
      functionName: "getMatchPlayerIds",
      args: [matchId]
    })) as bigint[];
  } catch (error) {
    console.error("[seed-players] readContract(getMatchPlayerIds) failed", error);
    throw error;
  }

  const existingIds = new Set(existing.map((id) => id));

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

  // Only the players missing on-chain. Keeps retries self-healing when a prior
  // run was interrupted after a partial seed.
  const missing = inputs.filter((input) => !existingIds.has(input.id));

  if (missing.length === 0) {
    return { matchId, alreadySeeded: true, playerCount: inputs.length };
  }

  // The RPC node rejects single transactions whose estimated gas exceeds its
  // call allowance (~2M gas). Seeding a full national-squad pool (56 players)
  // needs ~7M gas, so the write is chunked into batches that stay well under
  // the allowance. addPlayers is idempotent per player id, so partial runs
  // merge cleanly on retry.
  const chunkSize = Number(process.env.PLAYER_SEED_CHUNK_SIZE ?? 8);
  const chunks = Math.ceil(missing.length / chunkSize);

  // Fail fast with a clear message (instead of a cryptic 500 part-way through)
  // when the seeding wallet cannot afford the whole pool. This wallet is the
  // registry owner, so no other account can seed the players.
  const [balance, gasPrice] = await Promise.all([
    publicClient.getBalance({ address: account.address }).catch(() => null),
    publicClient.getGasPrice().catch(() => null)
  ]);

  let seedCostWei: bigint | null = null;
  if (balance !== null && gasPrice !== null) {
    const chunkGas = await publicClient
      .estimateContractGas({
        abi: playerRegistryAbi,
        address: registry,
        functionName: "addPlayers",
        args: [matchId, missing.slice(0, chunkSize)],
        account: account.address
      })
      .catch(() => null);

    // Every chunk costs roughly the same; add a 25% buffer for price variance.
    if (chunkGas !== null) {
      seedCostWei = (chunkGas * gasPrice * BigInt(chunks) * BigInt(25)) / BigInt(20);
    }
  }

  if (balance !== null && seedCostWei !== null && balance < seedCostWei) {
    throw new HttpError(
      402,
      "INSUFFICIENT_SEEDING_FUNDS",
      `Cannot seed the ${chain.name} player pool: the seeding wallet (${account.address}) holds ${formatBot(
        balance
      )} BOT but seeding ${chunks} batch(es) needs about ${formatBot(
        seedCostWei
      )} BOT. Fund that address (mainnet: bridge.botchain.ai / official BOT DEX; testnet: faucet.botchain.ai) and try again.`,
      { chainId: chain.id, wallet: account.address, balance: balance.toString(), required: seedCostWei.toString() }
    );
  }

  let lastTxHash: `0x${string}` | undefined;
  let nonce: number | null = null;

  for (let start = 0; start < missing.length; start += chunkSize) {
    // Fetch a fresh nonce per chunk. bohr's RPC shards can report a lagging
    // pending count, so the internal viem nonce manager drifts and chunk 4+
    // die with "nonce too low". Since we await each receipt, "latest" is exact.
    if (nonce === null) {
      nonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "latest" }).catch(() => null);
    } else {
      nonce = nonce + 1;
    }

    const chunk = missing.slice(start, start + chunkSize);
    const txHash = await walletClient.writeContract({
      abi: playerRegistryAbi,
      address: registry,
      functionName: "addPlayers",
      args: [matchId, chunk],
      ...(nonce !== null ? { nonce: Number(nonce) } : {})
    }).catch(async (error) => {
      const nonceDrift =
        error instanceof Error && /nonce too low|nonce provided for the transaction is incorrect/i.test(error.message);

      if (nonceDrift) {
        const freshNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: "latest" });
        return walletClient.writeContract({
          abi: playerRegistryAbi,
          address: registry,
          functionName: "addPlayers",
          args: [matchId, chunk],
          nonce: Number(freshNonce)
        });
      }

      const insufficientFunds =
        error instanceof Error &&
        /insufficient funds|insufficient balance|enough funds|sender.*balance/i.test(error.message);

      if (insufficientFunds) {
        const liveBalance = await publicClient.getBalance({ address: account.address }).catch(() => null);
        throw new HttpError(
          402,
          "INSUFFICIENT_SEEDING_FUNDS",
          `The ${chain.name} seeding wallet (${account.address}) ran out of BOT: ${
            liveBalance === null ? "balance unknown" : `balance is ${formatBot(liveBalance)} BOT`
          }. Fund it (mainnet: bridge.botchain.ai / official BOT DEX; testnet: faucet.botchain.ai) and retry - seeding is self-healing and continues from where it stopped.`,
          { chainId: chain.id, wallet: account.address, balance: liveBalance?.toString() }
        );
      }

      console.error(`[seed-players] writeContract(addPlayers) chunk ${start / chunkSize + 1} failed`, error);
      throw error;
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash }).catch((error) => {
      console.error("[seed-players] waitForTransactionReceipt failed", error);
      throw error;
    });

    if (receipt.status !== "success") {
      throw new HttpError(502, "PLAYER_SEED_TX_FAILED", "The player seeding transaction was reverted.");
    }

    lastTxHash = txHash;
  }

  return { matchId, alreadySeeded: false, playerCount: inputs.length, txHash: lastTxHash };
}
