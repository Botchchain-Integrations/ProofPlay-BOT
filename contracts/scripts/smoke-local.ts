import { ethers } from "hardhat";

async function main() {
  const [creator, alice, bob] = await ethers.getSigners();
  console.log("Creator:", creator.address);

  const PlayerRegistry = await ethers.getContractFactory("PlayerRegistry");
  const registry = await PlayerRegistry.deploy(creator.address);
  await registry.waitForDeployment();

  const matchId = ethers.id("ars-che-2026-05-24");
  await registry.addPlayers(matchId, [
    { id: 1n, name: "David Raya", team: "Arsenal", position: 0 },
    { id: 2n, name: "William Saliba", team: "Arsenal", position: 1 },
    { id: 3n, name: "Martin Odegaard", team: "Arsenal", position: 2 },
    { id: 4n, name: "Cole Palmer", team: "Chelsea", position: 2 },
    { id: 5n, name: "Nicolas Jackson", team: "Chelsea", position: 3 }
  ]);

  const now = (await ethers.provider.getBlock("latest"))!.timestamp;
  const deadline = BigInt(now + 3600);

  const MatchRoomFactory = await ethers.getContractFactory("MatchRoomFactory");
  const factory = await MatchRoomFactory.deploy();
  await factory.waitForDeployment();
  const factoryContract = factory as any;

  const entryFee = ethers.parseEther("0.01");
  const tx = await factoryContract
    .connect(creator)
    .createRoom(matchId, entryFee, 3n, deadline, await registry.getAddress());

  const receipt = await tx.wait();
  const created = receipt?.logs
    .map((log: any) => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((parsed: any) => parsed?.name === "RoomCreated");

  const roomAddress = created?.args.room as string;
  const room = (await ethers.getContractAt("FantasyMatchRoom", roomAddress)) as any;

  await room.connect(alice).joinRoom({ value: entryFee });
  await room.connect(bob).joinRoom({ value: entryFee });

  let invalidRevert = "none";
  try {
    await room.connect(alice).submitLineup([1n, 2n, 3n, 4n], 3n);
  } catch (err: any) {
    invalidRevert = err?.message || "unknown error";
  }
  console.log("Invalid lineup result:", invalidRevert);

  await room.connect(alice).submitLineup([1n, 2n, 3n, 4n, 5n], 3n);
  await room.connect(bob).submitLineup([1n, 2n, 4n, 3n, 5n], 4n);
  await room.connect(creator).lockRoom();

  await room.connect(creator).onAgentResponse(
    ethers.id("demo-stats-ars-che"),
    [
      { playerId: 1n, goals: 0, assists: 0, yellowCards: 0, redCards: 0, cleanSheet: true, minutesPlayed: 90 },
      { playerId: 2n, goals: 0, assists: 1, yellowCards: 0, redCards: 0, cleanSheet: true, minutesPlayed: 90 },
      { playerId: 3n, goals: 1, assists: 0, yellowCards: 1, redCards: 0, cleanSheet: false, minutesPlayed: 88 },
      { playerId: 4n, goals: 1, assists: 0, yellowCards: 0, redCards: 0, cleanSheet: false, minutesPlayed: 90 },
      { playerId: 5n, goals: 0, assists: 0, yellowCards: 1, redCards: 0, cleanSheet: false, minutesPlayed: 76 }
    ],
    "Smoke run receipt"
  );

  const winner = await room.winner();
  const scoreA = await room.scores(alice.address);
  const scoreB = await room.scores(bob.address);

  console.log("Room:", roomAddress);
  console.log("Winner:", winner);
  console.log("Scores:", scoreA.toString(), scoreB.toString());

  const winnerSigner = winner.toLowerCase() === alice.address.toLowerCase() ? alice : bob;
  await room.connect(winnerSigner).claimPrize();
  console.log("Prize claimed. Prize pool:", (await room.prizePool()).toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
