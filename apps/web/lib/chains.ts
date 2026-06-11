import { defineChain } from "viem";

const somniaChainId = Number(process.env.NEXT_PUBLIC_SOMNIA_CHAIN_ID ?? "50312");
const somniaRpcUrl = process.env.NEXT_PUBLIC_SOMNIA_RPC_URL ?? "https://50312.rpc.thirdweb.com";
const somniaExplorerUrl =
  process.env.NEXT_PUBLIC_SOMNIA_EXPLORER_URL ?? "https://testnet.somnia.exploreme.pro";
const anvilChainId = Number(process.env.NEXT_PUBLIC_ANVIL_CHAIN_ID ?? "31337");
const anvilRpcUrl = process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? "http://127.0.0.1:8545";

export const somniaTestnet = defineChain({
  id: somniaChainId,
  name: "Somnia Shannon Testnet",
  nativeCurrency: {
    name: "Somnia Test Token",
    symbol: "STT",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [somniaRpcUrl]
    }
  },
  blockExplorers: {
    default: {
      name: "Somnia Explorer",
      url: somniaExplorerUrl
    }
  }
});

export const anvilTestnet = defineChain({
  id: anvilChainId,
  name: "Anvil Local Testnet",
  nativeCurrency: {
    name: "Anvil Test Token",
    symbol: "STT",
    decimals: 18
  },
  rpcUrls: {
    default: {
      http: [anvilRpcUrl]
    }
  }
});

export const appChains = [somniaTestnet, anvilTestnet] as const;
