import { createPublicClient, createWalletClient, http, keccak256, toBytes, type Address, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { PlayerStats } from "@proofplay/shared";
import { botChain, botTestnet } from "@/lib/chains";
import { HttpError } from "../http-error";
import { createFootballProvider } from "../football-api";

// Server-only FantasyMatchRoom settlement.
//
// BOT Chain deploys MatchRoomFactory with somniaPlatform = address(0), so the
// contract's agent path (requestSettlement) is unreachable and settlement must
// go through onAgentResponse, which is creator-only. This service is that
// bridge: it reads the real final stats from the football provider, submits them
// on-chain signed by the room creator's key, and the contract scores every
// lineup deterministically on-chain.
//
// Because the provider data is public and the scoring rules live in the
// contract, the only trust assumption is that the submitted stats match the
// provider's; the receipt hash binds the payload that was priced.

const CHAINS: Record<number, Chain> = { [botChain.id]: botChain, [botTestnet.id]: botTestnet };

export const matchRoomAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "creator",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "locked",
    inputs: [],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "settled",
    inputs: [],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "payoutComplete",
    inputs: [],
    outputs: [{ name: "", type: "bool" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "winner",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "highestScore",
    inputs: [],
    outputs: [{ name: "", type: "int256" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "prizePool",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "scores",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "int256" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getParticipants",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getLineup",
    inputs: [{ name: "participant", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }]
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "lockRoom",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "onAgentResponse",
    inputs: [
      { name: "statsHash", type: "bytes32" },
      {
        name: "stats",
        type: "tuple[]",
        components: [
          { name: "playerId", type: "uint256" },
          { name: "goals", type: "uint8" },
          { name: "assists", type: "uint8" },
          { name: "yellowCards", type: "uint8" },
          { name: "redCards", type: "uint8" },
          { name: "cleanSheet", type: "bool" },
          { name: "minutesPlayed", type: "uint16" }
        ]
      },
      { name: "receiptText", type: "string" }
    ],
    outputs: []
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "claimPrize",
    inputs: [],
    outputs: []
  }
] as const;

export type SettlementResult = {
  roomAddress: Address;
  chainId: number;
  alreadySettled: boolean;
  lockedNow: boolean;
  winner: Address | null;
  highestScore: number;
  prizePool: string;
  statsHash: `0x${string}`;
  receiptText: string;
  settledPlayers: number;
  txHash: `0x${string}`;
  participants: { address: Address; score: number; lineup: number[] }[];
};

function deployerKey(): `0x${string}` {
  const key = process.env.DEPLOYER_PRIVATE_KEY?.trim();
  if (!key) {
    throw new HttpError(503, "DEPLOYER_NOT_CONFIGURED", "DEPLOYER_PRIVATE_KEY is not configured.");
  }
  return (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
}

function resolveChain(chainId?: number): Chain {
  return CHAINS[chainId ?? botChain.id] ?? botChain;
}

type RoomRead = {
  creator: () => Promise<Address>;
  locked: () => Promise<boolean>;
  settled: () => Promise<boolean>;
  payoutComplete: () => Promise<boolean>;
  winner: () => Promise<Address>;
  highestScore: () => Promise<bigint>;
  prizePool: () => Promise<bigint>;
  getParticipants: () => Promise<Address[]>;
  scores: (participant: Address) => Promise<bigint>;
  getLineup: (participant: Address) => Promise<bigint[]>;
};

function roomReader(publicClient: ReturnType<typeof createPublicClient>, room: Address): RoomRead {
  return {
    creator: () =>
      publicClient.readContract({ abi: matchRoomAbi, address: room, functionName: "creator" }) as Promise<Address>,
    locked: () =>
      publicClient.readContract({ abi: matchRoomAbi, address: room, functionName: "locked" }) as Promise<boolean>,
    settled: () =>
      publicClient.readContract({ abi: matchRoomAbi, address: room, functionName: "settled" }) as Promise<boolean>,
    payoutComplete: () =>
      publicClient.readContract({
        abi: matchRoomAbi,
        address: room,
        functionName: "payoutComplete"
      }) as Promise<boolean>,
    winner: () =>
      publicClient.readContract({ abi: matchRoomAbi, address: room, functionName: "winner" }) as Promise<Address>,
    highestScore: () =>
      publicClient.readContract({ abi: matchRoomAbi, address: room, functionName: "highestScore" }) as Promise<bigint>,
    prizePool: () =>
      publicClient.readContract({ abi: matchRoomAbi, address: room, functionName: "prizePool" }) as Promise<bigint>,
    getParticipants: () =>
      publicClient.readContract({
        abi: matchRoomAbi,
        address: room,
        functionName: "getParticipants"
      }) as Promise<Address[]>,
    scores: (participant) =>
      publicClient.readContract({
        abi: matchRoomAbi,
        address: room,
        functionName: "scores",
        args: [participant]
      }) as Promise<bigint>,
    getLineup: (participant) =>
      publicClient.readContract({
        abi: matchRoomAbi,
        address: room,
        functionName: "getLineup",
        args: [participant]
      }) as Promise<bigint[]>
  };
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
const ZERO_HASH = ("0x" + "0".repeat(64)) as `0x${string}`;

/**
 * Settles a room with real provider stats.
 *
 * Locks the room first (creator-authorized early lock), then submits the final
 * per-player stats for exactly the players that appear in a submitted lineup.
 * The contract scores every lineup on-chain, so the winner is determined by
 * contract logic, not by this service.
 */
export async function settleRoom(input: {
  roomAddress: Address;
  fixtureId: string;
  chainId?: number;
}): Promise<SettlementResult> {
  const chain = resolveChain(input.chainId);
  const room = input.roomAddress;
  const account = privateKeyToAccount(deployerKey());

  const publicClient = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0])
  });

  const read = roomReader(publicClient, room);

  const [creator, locked, settled] = await Promise.all([read.creator(), read.locked(), read.settled()]);
  const participants = (await read.getParticipants()) ?? [];

  // Idempotent: report the recorded outcome instead of re-settling.
  if (settled) {
    const [winner, highestScore, prizePool] = await Promise.all([read.winner(), read.highestScore(), read.prizePool()]);
    const results = await Promise.all(
      participants.map(async (address) => ({
        address,
        score: Number(await read.scores(address)),
        lineup: ((await read.getLineup(address)) ?? []).map(Number)
      }))
    );

    return {
      roomAddress: room,
      chainId: chain.id,
      alreadySettled: true,
      lockedNow: locked,
      winner: winner && winner !== ZERO_ADDRESS ? winner : null,
      highestScore: Number(highestScore),
      prizePool: prizePool.toString(),
      statsHash: ZERO_HASH,
      receiptText: "Room was already settled on-chain.",
      settledPlayers: results.length,
      txHash: ZERO_HASH,
      participants: results
    };
  }

  if (participants.length === 0) {
    throw new HttpError(409, "ROOM_NO_PARTICIPANTS", "Room has no participants to settle.");
  }

  // Collect exactly the players referenced by a submitted lineup.
  const lineups = await Promise.all(
    participants.map(async (address) => ({
      address,
      lineup: ((await read.getLineup(address)) ?? []).map(Number)
    }))
  );

  const playerIds = Array.from(
    new Set(lineups.flatMap((entry) => entry.lineup))
  ).sort((left, right) => left - right);

  if (playerIds.length === 0) {
    throw new HttpError(
      409,
      "ROOM_NO_LINEUPS",
      "No participant has submitted a lineup yet, so there is nothing to settle."
    );
  }

  // Real final stats from the football provider.
  const provider = createFootballProvider();
  if (!provider) {
    throw new HttpError(503, "FOOTBALL_API_NOT_CONFIGURED", "FOOTBALL_API_KEY is not configured.");
  }

  let providerStats: PlayerStats[];
  try {
    const response = await provider.getMatchStats(input.fixtureId);
    providerStats = response.players;
  } catch (error) {
    throw new HttpError(
      502,
      "MATCH_STATS_UNAVAILABLE",
      `Could not read final stats for fixture ${input.fixtureId}: ${
        error instanceof Error ? error.message : "provider error"
      }. Settlement only works once the match has finished.`
    );
  }

  const statByPlayerId = new Map<number, PlayerStats>();
  for (const stat of providerStats) {
    statByPlayerId.set(stat.playerId, stat);
  }

  // Every player in a lineup needs a stat or the contract reverts with
  // "Missing stat for player".
  const stats = playerIds.map((playerId) => {
    const stat = statByPlayerId.get(playerId);
    if (!stat) {
      throw new HttpError(
        502,
        "MATCH_STATS_INCOMPLETE",
        `No final stat reported for player ${playerId} in fixture ${input.fixtureId}.`
      );
    }

    return {
      playerId: BigInt(playerId),
      goals: stat.goals,
      assists: stat.assists,
      yellowCards: stat.yellowCards,
      redCards: stat.redCards,
      cleanSheet: stat.cleanSheet,
      minutesPlayed: stat.minutesPlayed
    };
  });

  const walletClient = createWalletClient({ account, chain, transport: http(chain.rpcUrls.default.http[0]) });

  // Only the room creator can submit the settlement callback.
  if (creator.toLowerCase() !== account.address.toLowerCase()) {
    throw new HttpError(
      403,
      "SETTLER_NOT_CREATOR",
      `Room creator is ${creator} but the configured DEPLOYER_PRIVATE_KEY is ${account.address}. onAgentResponse is creator-only, so settlement must be submitted by the creator's key.`
    );
  }

  // Lock before settling: onAgentResponse requires a locked room.
  let lockedNow = locked;
  if (!lockedNow) {
    const lockHash = await walletClient.writeContract({
      abi: matchRoomAbi,
      address: room,
      functionName: "lockRoom"
    });
    const lockReceipt = await publicClient.waitForTransactionReceipt({ hash: lockHash });
    if (lockReceipt.status !== "success") {
      throw new HttpError(502, "ROOM_LOCK_TX_FAILED", "Locking the room before settlement reverted.");
    }
    lockedNow = true;
  }

  // Bind the exact payload that was priced into the receipt hash.
  const statsHash = keccak256(
    toBytes(
      stats
        .map(
          (stat) =>
            `${stat.playerId}:${stat.goals}:${stat.assists}:${stat.yellowCards}:${stat.redCards}:${
              stat.cleanSheet ? 1 : 0
            }:${stat.minutesPlayed}`
        )
        .join(",")
    )
  );

  const receiptText = `Settled with final stats from ${provider.constructor.name.replace(/ApiFootballProvider/, "apifootball")} for fixture ${input.fixtureId}.`;

  const txHash = await walletClient.writeContract({
    abi: matchRoomAbi,
    address: room,
    functionName: "onAgentResponse",
    args: [statsHash, stats, receiptText]
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new HttpError(502, "ROOM_SETTLE_TX_FAILED", "The settlement transaction reverted.");
  }

  const [winner, highestScore, prizePool] = await Promise.all([read.winner(), read.highestScore(), read.prizePool()]);

  const results = await Promise.all(
    participants.map(async (address) => ({
      address,
      score: Number(await read.scores(address)),
      lineup: lineups.find((entry) => entry.address === address)?.lineup ?? []
    }))
  );

  return {
    roomAddress: room,
    chainId: chain.id,
    alreadySettled: false,
    lockedNow: true,
    winner: winner && winner !== ZERO_ADDRESS ? winner : null,
    highestScore: Number(highestScore),
    prizePool: prizePool.toString(),
    statsHash,
    receiptText,
    settledPlayers: results.length,
    txHash,
    participants: results
  };
}

/**
 * Pays the recorded winner their pot. Only the winner may call claimPrize, so
 * the caller must sign with that address' key.
 */
export async function claimRoomPrize(input: {
  roomAddress: Address;
  chainId?: number;
}): Promise<{ roomAddress: Address; txHash: `0x${string}`; alreadyClaimed: boolean }> {
  const chain = resolveChain(input.chainId);
  const room = input.roomAddress;
  const account = privateKeyToAccount(deployerKey());

  const publicClient = createPublicClient({ chain, transport: http(chain.rpcUrls.default.http[0]) });

  const read = roomReader(publicClient, room);

  const [settled, payoutComplete, winner] = await Promise.all([
    read.settled(),
    read.payoutComplete(),
    read.winner()
  ]);

  if (!settled) {
    throw new HttpError(409, "ROOM_NOT_SETTLED", "Room is not settled yet, so the prize cannot be claimed.");
  }

  if (payoutComplete) {
    return { roomAddress: room, txHash: ZERO_HASH, alreadyClaimed: true };
  }

  if (winner.toLowerCase() !== account.address.toLowerCase()) {
    throw new HttpError(
      403,
      "CALLER_NOT_WINNER",
      `Winner is ${winner} but the configured DEPLOYER_PRIVATE_KEY is ${account.address}. claimPrize is winner-only.`
    );
  }

  const walletClient = createWalletClient({ account, chain, transport: http(chain.rpcUrls.default.http[0]) });

  const txHash = await walletClient.writeContract({
    abi: matchRoomAbi,
    address: room,
    functionName: "claimPrize"
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new HttpError(502, "PRIZE_CLAIM_TX_FAILED", "The prize claim transaction reverted.");
  }

  return { roomAddress: room, txHash, alreadyClaimed: false };
}