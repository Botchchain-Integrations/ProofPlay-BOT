import { ethers } from "hardhat";

const DEFAULT_MATCH_KEY = "ars-che-2026-05-24:Arsenal:Chelsea";

async function main() {
  const registryAddress = process.env.REGISTRY_ADDRESS;

  if (!registryAddress || !ethers.isAddress(registryAddress)) {
    throw new Error("Set REGISTRY_ADDRESS to a valid PlayerRegistry contract address.");
  }

  const matchKey = process.env.MATCH_KEY ?? DEFAULT_MATCH_KEY;
  const matchId = ethers.keccak256(ethers.toUtf8Bytes(matchKey));

  const registry = await ethers.getContractAt("PlayerRegistry", registryAddress);
  const existingPlayerIds: bigint[] = await registry.getMatchPlayerIds(matchId);

  if (existingPlayerIds.length > 0) {
    console.log("Players already exist for this matchId.");
    console.log("matchKey:", matchKey);
    console.log("matchId:", matchId);
    console.log("playerIds:", existingPlayerIds.map((id) => id.toString()).join(", "));
    return;
  }

  const addPlayersTx = await registry.addPlayers(matchId, [
    { id: 1n, name: "David Raya", team: "Arsenal", position: 0 },
    { id: 2n, name: "William Saliba", team: "Arsenal", position: 1 },
    { id: 3n, name: "Martin Odegaard", team: "Arsenal", position: 2 },
    { id: 4n, name: "Cole Palmer", team: "Chelsea", position: 2 },
    { id: 5n, name: "Nicolas Jackson", team: "Chelsea", position: 3 }
  ]);
  await addPlayersTx.wait();

  console.log("Demo players seeded.");
  console.log("matchKey:", matchKey);
  console.log("matchId:", matchId);
  console.log("registry:", registryAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
