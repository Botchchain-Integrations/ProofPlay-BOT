import type { Address } from "viem";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;
export const LAST_ROOM_ADDRESS_STORAGE_KEY = "proofplay:last-room-address";

export const SOMNIA_PLATFORM_ADDRESS = "0x7407cb35a17D511D1Bd32dD726ADb8D5344ECbE3" as Address;

export const contractAddresses = {
  factory: (process.env.NEXT_PUBLIC_FACTORY_ADDRESS ?? ZERO_ADDRESS) as Address,
  registry: (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ?? ZERO_ADDRESS) as Address,
  room: (process.env.NEXT_PUBLIC_ROOM_ADDRESS ?? ZERO_ADDRESS) as Address,
  platform: (process.env.NEXT_PUBLIC_SOMNIA_PLATFORM_ADDRESS ?? SOMNIA_PLATFORM_ADDRESS) as Address
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
