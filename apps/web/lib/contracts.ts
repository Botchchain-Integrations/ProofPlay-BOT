import type { Address } from "viem";
import { botChain, botTestnet } from "@/lib/chains";
import { useChainId } from "wagmi";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
export const LAST_ROOM_ADDRESS_STORAGE_KEY = "proofplay:last-room-address";
// Cookie key the network toggle writes so server components read the same chain.
export const CHAIN_COOKIE = "proofplay_chain";

// Per-network deployed contract addresses. Server default is mainnet.
// The registries below are the OPEN-seeding PlayerRegistry deploy (addPlayers
// callable by any wallet so room creators fund seeding with their own gas).
export const CONTRACT_ADDRESSES: Record<number, { factory: Address; registry: Address }> = {
  [botChain.id]: {
    factory: (process.env.NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS ??
      "0x71601e379643e8dD704991C6dD1FDbD5630C4Ce7") as Address,
    // Open-seeding registry, owned by the deployer, so setPlayerStatus
    // (owner-only, not called by the UI) remains admin-able.
    registry: (process.env.NEXT_PUBLIC_MAINNET_REGISTRY_ADDRESS ??
      "0xFb7fC70271B672af11F7C08e5584cB87c1cABa5c") as Address
  },
  [botTestnet.id]: {
    factory: (process.env.NEXT_PUBLIC_TESTNET_FACTORY_ADDRESS ??
      "0xf6920D45d16c5FAa9eB40753Bb3F16D353355705") as Address,
    registry: (process.env.NEXT_PUBLIC_TESTNET_REGISTRY_ADDRESS ??
      "0xfEbCdDA771561Bc92D290C993e07Aa8552083A61") as Address
  }
};

export function getContractAddresses(chainId: number) {
  return CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[botChain.id];
}

// Client-side hook: resolves factory/registry on the currently active wagmi chain.
export function useContractAddresses() {
  const chainId = useChainId();
  const addresses = getContractAddresses(chainId);
  return {
    factory: addresses.factory,
    registry: addresses.registry,
    room: (process.env.NEXT_PUBLIC_ROOM_ADDRESS ?? ZERO_ADDRESS) as Address
  };
}

// Back-compat default addresses (mainnet).
export const contractAddresses = {
  factory: getContractAddresses(botChain.id).factory,
  registry: getContractAddresses(botChain.id).registry,
  room: (process.env.NEXT_PUBLIC_ROOM_ADDRESS ?? ZERO_ADDRESS) as Address
};

export function hasConfiguredAddress(address: Address) {
  return address.toLowerCase() !== ZERO_ADDRESS.toLowerCase();
}

export const matchRoomFactoryAbi = [
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "createRoom",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "entryFee", type: "uint256" },
      { name: "maxParticipants", type: "uint256" },
      { name: "lineupDeadline", type: "uint256" },
      { name: "registry", type: "address" }
    ],
    outputs: [{ name: "roomAddress", type: "address" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getRooms",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }]
  }
] as const;

export const fantasyMatchRoomAbi = [
  {
    type: "function",
    stateMutability: "view",
    name: "matchId",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }]
  },
  {
    type: "function",
    stateMutability: "payable",
    name: "joinRoom",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "submitLineup",
    inputs: [
      { name: "playerIds", type: "uint256[]" },
      { name: "captainId", type: "uint256" }
    ],
    outputs: []
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
    name: "requestSettlement",
    inputs: [],
    outputs: []
  },
  {
    type: "function",
    stateMutability: "nonpayable",
    name: "claimPrize",
    inputs: [],
    outputs: []
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
    name: "lineupDeadline",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "maxParticipants",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "entryFee",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
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
    name: "winner",
    inputs: [],
    outputs: [{ name: "", type: "address" }]
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
    name: "prizePool",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "latestReceipt",
    inputs: [],
    outputs: [{ name: "", type: "string" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "scores",
    inputs: [{ name: "participant", type: "address" }],
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
  }
] as const;

export const playerRegistryAbi = [
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
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getMatchPlayerIds",
    inputs: [{ name: "matchId", type: "bytes32" }],
    outputs: [{ name: "", type: "uint256[]" }]
  },
  {
    type: "function",
    stateMutability: "view",
    name: "getPlayer",
    inputs: [
      { name: "matchId", type: "bytes32" },
      { name: "playerId", type: "uint256" }
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "id", type: "uint256" },
          { name: "name", type: "string" },
          { name: "team", type: "string" },
          { name: "position", type: "uint8" },
          { name: "active", type: "bool" },
          { name: "exists", type: "bool" }
        ]
      }
    ]
  }
] as const;
