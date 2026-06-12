import { expect } from "chai";
import { ethers } from "hardhat";

describe("FantasyMatchRoom MVP", function () {
  async function deployFixture() {
    const [creator, alice, bob, carol] = await ethers.getSigners();

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
    const factory = (await MatchRoomFactory.deploy(ethers.ZeroAddress)) as any;
    await factory.waitForDeployment();

    const entryFee = ethers.parseEther("0.01");

    const tx = await (factory
      .connect(creator)
      .createRoom(matchId, entryFee, 3n, deadline, await registry.getAddress())) as any;

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

    return {
      creator,
      alice,
      bob,
      carol,
      registry,
      room,
      entryFee,
      matchId
    };
  }

  it("runs create -> join -> submit -> lock -> settle -> claim flow", async function () {
    const { creator, alice, bob, room, entryFee } = await deployFixture();

    await room.connect(alice).joinRoom({ value: entryFee });
    await room.connect(bob).joinRoom({ value: entryFee });

    await room.connect(alice).submitLineup([1n, 2n, 3n, 4n, 5n], 3n);
    await room.connect(bob).submitLineup([1n, 2n, 4n, 3n, 5n], 4n);

    await room.connect(creator).lockRoom();

    await room.connect(creator).onAgentResponse(
      ethers.id("demo-stats-ars-che"),
      [
        {
          playerId: 1n,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          cleanSheet: true,
          minutesPlayed: 90
        },
        {
          playerId: 2n,
          goals: 0,
          assists: 1,
          yellowCards: 0,
          redCards: 0,
          cleanSheet: true,
          minutesPlayed: 90
        },
        {
          playerId: 3n,
          goals: 1,
          assists: 0,
          yellowCards: 1,
          redCards: 0,
          cleanSheet: false,
          minutesPlayed: 88
        },
        {
          playerId: 4n,
          goals: 1,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          cleanSheet: false,
          minutesPlayed: 90
        },
        {
          playerId: 5n,
          goals: 0,
          assists: 0,
          yellowCards: 1,
          redCards: 0,
          cleanSheet: false,
          minutesPlayed: 76
        }
      ],
      "Saber FC wins with captain contribution and clean-sheet boost"
    );

    const winner = await room.winner();
    const aliceAddress = alice.address;
    const bobAddress = bob.address;

    expect([aliceAddress, bobAddress]).to.include(winner);
    expect(await room.settled()).to.equal(true);

    const scoreAlice = await room.scores(aliceAddress);
    const scoreBob = await room.scores(bobAddress);

    expect(scoreAlice).to.not.equal(0n);
    expect(scoreBob).to.not.equal(0n);

    const winnerSigner = winner === aliceAddress ? alice : bob;
    const winnerBalanceBefore = await ethers.provider.getBalance(winnerSigner.address);

    const claimTx = await room.connect(winnerSigner).claimPrize();
    const claimReceipt = await claimTx.wait();
    const winnerBalanceAfter = await ethers.provider.getBalance(winnerSigner.address);

    expect(claimReceipt?.status).to.equal(1);
    expect(winnerBalanceAfter).to.be.gt(winnerBalanceBefore);

    expect(await room.payoutComplete()).to.equal(true);
    expect(await room.prizePool()).to.equal(0n);
  });

  it("rejects invalid lineup shape", async function () {
    const { alice, room, entryFee } = await deployFixture();

    await room.connect(alice).joinRoom({ value: entryFee });

    await expect(room.connect(alice).submitLineup.staticCall([1n, 2n, 3n, 4n], 3n)).to.be.revertedWith(
      "Lineup must have 5 players"
    );
  });
});
