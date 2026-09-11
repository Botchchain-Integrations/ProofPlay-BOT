import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient } from "@tanstack/react-query";
import { http } from "wagmi";
import { appChains, botTestnet } from "@/lib/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "proofplay-dev-project-id";

export const wagmiConfig = getDefaultConfig({
  appName: "ProofPlay",
  projectId: walletConnectProjectId,
  chains: appChains,
  ssr: true,
  transports: {
    [botTestnet.id]: http(botTestnet.rpcUrls.default.http[0])
  }
});

export const queryClient = new QueryClient();
