import { cookies } from "next/headers";
import { botChain, botTestnet } from "@/lib/chains";
import { CHAIN_COOKIE } from "@/lib/contracts";

// Server-side: resolves the active BOT network from the user's network toggle.
// Defaults to mainnet (677) when the cookie is absent or invalid.
export async function getActiveChain() {
  const store = await cookies();
  const raw = store.get(CHAIN_COOKIE)?.value;
  const chainId = raw && /^\d+$/.test(raw) ? Number(raw) : botChain.id;
  return chainId === botTestnet.id ? botTestnet : botChain;
}