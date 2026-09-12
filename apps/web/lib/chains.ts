import { defineChain } from "viem";

// BOT Chain mainnet (chain 677).
export const botChain = defineChain({
  id: 677,
  name: "BOT Chain",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.botchain.ai"]
    }
  },
  blockExplorers: {
    default: {
      name: "BOT Explorer",
      url: "https://scan.botchain.ai"
    }
  }
});

// BOT Chain testnet (chain 968).
export const botTestnet = defineChain({
  id: 968,
  name: "BOT Chain Testnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.bohr.life"]
    }
  },
  blockExplorers: {
    default: {
      name: "BOT Explorer",
      url: "https://scan.bohr.life"
    }
  }
});

export const appChains = [botChain, botTestnet] as const;