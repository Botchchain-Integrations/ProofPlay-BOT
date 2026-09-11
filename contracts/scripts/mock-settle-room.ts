import { ethers } from "hardhat";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

function sortBigInts(values: bigint[]) {
  return values.sort((left, right) => {
    if (left < right) {
      return -1;
    }

    if (left > right) {
      return 1;
    }

    return 0;
  });
}

interface SnapshotStat {
  playerId: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  cleanSheet: boolean;
  minutesPlayed: number;
}

interface Snapshot {
  fixtureId: string;
  matchKey: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  stats: SnapshotStat[];
}

// Loads the real match snapshot written by seed-demo-players.ts so the room
// is settled with the same final stats the frontend shows.
function loadSnapshot(fixtureId: string): Snapshot {
  const file = path.join(__dirname, "..", "data", `match-${fixtureId}.json`);

  if (!existsSync(file)) {
    throw new Error(
      `No snapshot found at ${file}. Run seed-demo-players.ts first to seed players and write real stats.`
    );
  }

  return JSON.parse(readFileSync(file, "utf8")) as Snapshot;
}

async function main() {
  const roomAddress = process.env.ROOM_ADDRESS;

  if (!roomAddress || !ethers.isAddress(roomAddress)) {
    throw new Error("Set ROOM_ADDRESS to a valid FantasyMatchRoom contract address.");
  }

  const fixtureId = process.env.FIXTURE_ID ?? "812679";
  const snapshot = loadSnapshot(fixtureId);

  const room = (await ethers.getContractAt("FantasyMatchRoom", roomAddress)) as any;
  const creatorAddress = (await room.creator()).toLowerCase();
  const signers = await ethers.getSigners();
  const creatorSigner = signers.find((signer) => signer.address.toLowerCase() === creatorAddress);

  if (!creatorSigner) {
    throw new Error(`Creator signer ${creatorAddress} is not available in this wallet.`);
  }

  const roomAsCreator = room.connect(creatorSigner) as any;
  const participants: string[] = await room.getParticipants();

  if (participants.length === 0) {
    throw new Error("Room has no participants yet.");
  }

  if (await room.settled()) {
    console.log("Room is already settled.");
    console.log("Winner:", await room.winner());
    return;
  }

  if (!(await room.locked())) {
    const lockTx = await roomAsCreator.lockRoom();
    await lockTx.wait();
    console.log("Room locked.");
  }

  const settlementRequestTx = await roomAsCreator.requestSettlement();
  await settlementRequestTx.wait();
  console.log("Settlement requested.");

  const uniquePlayerIds = new Set<string>();

  for (const participant of participants) {
    const lineup: bigint[] = await room.getLineup(participant);

    for (const playerId of lineup) {
      uniquePlayerIds.add(playerId.toString());
    }
  }

  const playerIds = sortBigInts(Array.from(uniquePlayerIds, (value) => BigInt(value)));

  if (playerIds.length === 0) {
    throw new Error("Could not build stats payload. No lineup player IDs found.");
  }

  const statByPlayerId = new Map<number, SnapshotStat>();
  for (const stat of snapshot.stats) {
    statByPlayerId.set(stat.playerId, stat);
  }

  const stats = playerIds.map((playerId) => {
    const stat = statByPlayerId.get(Number(playerId));

    if (!stat) {
      throw new Error(`Missing real stat for seeded player ${playerId}. Re-run seed-demo-players.ts.`);
    }

    return {
      playerId,
      goals: stat.goals,
      assists: stat.assists,
      yellowCards: stat.yellowCards,
      redCards: stat.redCards,
      cleanSheet: stat.cleanSheet,
      minutesPlayed: stat.minutesPlayed
    };
  });

  const statsHash = ethers.keccak256(ethers.toUtf8Bytes(playerIds.map((value) => value.toString()).join(",")));
  const receiptText = `Settled with real APIfootball stats for ${snapshot.matchKey} on BOT Chain Testnet.`;

  const settleTx = await roomAsCreator.onAgentResponse(statsHash, stats, receiptText);
  await settleTx.wait();

  console.log("Settlement callback executed.");
  console.log("Winner:", await room.winner());

  for (const participant of participants) {
    const score = await room.scores(participant);
    console.log(`Score ${participant}:`, score.toString());
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});