import { ethers } from "hardhat";

// Claims the prize on a settled room as the winning participant.
// Assumes the deployer wallet owns the winning lineup (as in e2e-proofplay.ts).

async function main() {
  const roomAddress = process.env.ROOM_ADDRESS;

  if (!roomAddress || !ethers.isAddress(roomAddress)) {
    throw new Error("Set ROOM_ADDRESS to a valid FantasyMatchRoom contract address.");
  }

  const [signer] = await ethers.getSigners();
  const room = await ethers.getContractAt("FantasyMatchRoom", roomAddress, signer);

  const settled = await room.settled();
  const winner = await room.winner();
  const payoutComplete = await room.payoutComplete();

  if (!settled) {
    throw new Error("Room is not settled yet. Run mock-settle-room.ts first.");
  }

  if (winner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`Signer ${signer.address} is not the winner (${winner}).`);
  }

  if (payoutComplete) {
    console.log("Prize already claimed.");
    return;
  }

  const prizePoolBefore = await room.prizePool();

  const claimTx = await room.claimPrize();
  await claimTx.wait();

  console.log("Prize claimed on BOT Chain Testnet.");
  console.log("roomAddress:", roomAddress);
  console.log("winner:", winner);
  console.log("amount (tBOT):", ethers.formatEther(prizePoolBefore));
  console.log("payoutComplete:", await room.payoutComplete());
  console.log("remaining prizePool:", ethers.formatEther(await room.prizePool()));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});