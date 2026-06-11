import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient } from "@tanstack/react-query";
import { http } from "wagmi";
import { anvilTestnet, appChains, somniaTestnet } from "@/lib/chains";

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "proofplay-dev-project-id";

export const wagmiConfig = getDefaultConfig({
  appName: "Proof of Play",
  projectId: walletConnectProjectId,
  chains: appChains,
  ssr: true,
  transports: {
    [somniaTestnet.id]: http(somniaTestnet.rpcUrls.default.http[0]),
    [anvilTestnet.id]: http(anvilTestnet.rpcUrls.default.http[0])
  }
});

export const queryClient = new QueryClient();
