import { defineChain } from "viem";

const botChainId = Number(process.env.NEXT_PUBLIC_BOT_CHAIN_ID ?? "677");
const botRpcUrl = process.env.NEXT_PUBLIC_BOT_RPC_URL ?? "https://rpc.botchain.ai";
const botExplorerUrl = process.env.NEXT_PUBLIC_BOT_EXPLORER_URL ?? "https://scan.botchain.ai";

export const botChain = defineChain({
  id: botChainId,
  name: "BOT Chain",
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

export const appChains = [botChain] as const;
