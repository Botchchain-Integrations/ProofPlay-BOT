import { ethers } from "hardhat";

// End-to-end room lifecycle on BOT Chain Testnet: create -> join -> lineup ->
// lock -> request settlement. Runs the creator-side steps; settlement with real
// stats happens via mock-settle-room.ts (prints the command), and claiming via
// claim-prize.ts.

async function main() {
  const factoryAddress = process.env.FACTORY_ADDRESS;
  const registryAddress = process.env.REGISTRY_ADDRESS;

  if (!factoryAddress || !ethers.isAddress(factoryAddress)) {
    throw new Error("Set FACTORY_ADDRESS to a valid MatchRoomFactory contract address.");
  }
  if (!registryAddress || !ethers.isAddress(registryAddress)) {
    throw new Error("Set REGISTRY_ADDRESS to a valid PlayerRegistry contract address.");
  }

  const matchKey = process.env.MATCH_KEY ?? "812679:Arsenal:Chelsea";
  const entryFeeEth = process.env.ENTRY_FEE ?? "0.01";
  const maxParticipants = process.env.MAX_PARTICIPANTS ?? "2";
  const deadlineMinutes = Number(process.env.DEADLINE_MINUTES ?? "60");

  if (!Number.isFinite(deadlineMinutes) || deadlineMinutes <= 0) {
    throw new Error("DEADLINE_MINUTES must be a positive number.");
  }

  const [deployer] = await ethers.getSigners();
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  const entryFee = ethers.parseEther(entryFeeEth);

  if (deployerBalance < entryFee) {
    throw new Error(`Deployer balance ${ethers.formatEther(deployerBalance)} tBOT is below the ${entryFeeEth} tBOT entry fee.`);
  }

  const matchId = ethers.keccak256(ethers.toUtf8Bytes(matchKey));
  const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineMinutes * 60);

  const factory = await ethers.getContractAt("MatchRoomFactory", factoryAddress, deployer);
  const roomsBefore = await factory.totalRooms();

  const createTx = await factory.createRoom(
    matchId,
    entryFee,
    BigInt(maxParticipants),
    deadline,
    registryAddress
  );
  const createReceipt = await createTx.wait();

  let roomAddress: string | null = null;

  for (const log of createReceipt.logs ?? []) {
    try {
      const parsed = factory.interface.parseLog(log);

      if (parsed?.name === "RoomCreated") {
        roomAddress = String(parsed.args.room);
      }
    } catch {
      // not a factory log - skip
    }
  }

  if (!roomAddress || !ethers.isAddress(roomAddress)) {
    const rooms = await factory.getRooms();

    if (rooms.length <= roomsBefore) {
      throw new Error("Could not resolve the created room address.");
    }

    roomAddress = rooms[rooms.length - 1];
  }

  const room = await ethers.getContractAt("FantasyMatchRoom", roomAddress!, deployer);

  const joinTx = await room.joinRoom({ value: entryFee });
  await joinTx.wait();

  const lineup = [1, 2, 6, 9, 20];
  const captain = 9;

  const lineupTx = await room.submitLineup(lineup.map((id) => BigInt(id)), BigInt(captain));
  await lineupTx.wait();

  const lockTx = await room.lockRoom();
  await lockTx.wait();

  const requestTx = await room.requestSettlement();
  await requestTx.wait();

  console.log("Room created on BOT Chain Testnet.");
  console.log("matchKey:", matchKey);
  console.log("matchId:", matchId);
  console.log("roomAddress:", roomAddress);
  console.log("entryFee (tBOT):", entryFeeEth);
  console.log("lineup:", lineup.join(","), "captain:", captain);
  console.log("participants:", (await room.getParticipants()).length);
  console.log("locked:", await room.locked());
  console.log("settled:", await room.settled());
  console.log("prizePool (tBOT):", ethers.formatEther(await room.prizePool()));
  console.log("");
  console.log("Next step - settle with real stats:");
  console.log(`ROOM_ADDRESS=${roomAddress} FIXTURE_ID=812679 pnpm --filter @proofplay/contracts exec hardhat run scripts/mock-settle-room.ts --network botTestnet`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});