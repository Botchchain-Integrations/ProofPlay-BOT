import { ethers } from "hardhat";

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

async function main() {
  const roomAddress = process.env.ROOM_ADDRESS;

  if (!roomAddress || !ethers.isAddress(roomAddress)) {
    throw new Error("Set ROOM_ADDRESS to a valid FantasyMatchRoom contract address.");
  }

  const room = await ethers.getContractAt("FantasyMatchRoom", roomAddress);
  const creatorAddress = (await room.creator()).toLowerCase();
  const signers = await ethers.getSigners();
  const creatorSigner = signers.find((signer) => signer.address.toLowerCase() === creatorAddress);

  if (!creatorSigner) {
    throw new Error(`Creator signer ${creatorAddress} is not available in this local node.`);
  }

  const roomAsCreator = room.connect(creatorSigner);
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

  const stats = playerIds.map((playerId, index) => ({
    playerId,
    goals: index % 5 === 0 ? 1 : 0,
    assists: index % 5 === 1 ? 1 : 0,
    yellowCards: index % 5 === 2 ? 1 : 0,
    redCards: 0,
    cleanSheet: index % 2 === 0,
    minutesPlayed: 90
  }));

  const statsHash = ethers.keccak256(ethers.toUtf8Bytes(playerIds.map((value) => value.toString()).join(",")));
  const receiptText = `Mock settlement completed on ${new Date().toISOString()}.`;

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
