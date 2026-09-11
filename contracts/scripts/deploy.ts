import { ethers } from "hardhat";

// BOT Chain has no Somnia agent platform. Deploy with address(0) so the
// FantasyMatchRoom uses the manual creator settlement path (onAgentResponse).
const BOT_CHAIN_ZERO_PLATFORM = "0x0000000000000000000000000000000000000000";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("Deploying contracts with:", deployer.address);

  const PlayerRegistry = await ethers.getContractFactory("PlayerRegistry");
  const playerRegistry = await PlayerRegistry.deploy(deployer.address);
  await playerRegistry.waitForDeployment();

  const MatchRoomFactory = await ethers.getContractFactory("MatchRoomFactory");
  const matchRoomFactory = await MatchRoomFactory.deploy(BOT_CHAIN_ZERO_PLATFORM);
  await matchRoomFactory.waitForDeployment();

  const network = await ethers.provider.getNetwork();

  console.log("Network chainId:", network.chainId);
  console.log("PlayerRegistry:", await playerRegistry.getAddress());
  console.log("MatchRoomFactory:", await matchRoomFactory.getAddress());
  console.log("SomniaPlatform (disabled):", BOT_CHAIN_ZERO_PLATFORM);
  console.log("\nNext:");
  console.log("1) Add players per match to PlayerRegistry");
  console.log("2) Create rooms from MatchRoomFactory");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});