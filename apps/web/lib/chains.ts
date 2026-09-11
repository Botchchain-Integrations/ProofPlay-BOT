import { defineChain } from "viem";

const botChainId = Number(process.env.NEXT_PUBLIC_BOT_CHAIN_ID ?? "968");
const botRpcUrl = process.env.NEXT_PUBLIC_BOT_RPC_URL ?? "https://rpc.bohr.life";
const botExplorerUrl = process.env.NEXT_PUBLIC_BOT_EXPLORER_URL ?? "https://scan.bohr.life";

export const botTestnet = defineChain({
  id: botChainId,
  name: "BOT Chain Testnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [botRpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: "BOT Explorer",
      url: botExplorerUrl
    }
  }
});

export const appChains = [botTestnet] as const;
