"use client";

import { useChainId } from "wagmi";
import { botChain, botTestnet } from "@/lib/chains";
import { getContractAddresses } from "@/lib/contracts";

export function ProofFooter() {
  const chainId = useChainId();
  const activeChainId = chainId === botTestnet.id ? botTestnet.id : botChain.id;
  const activeChain = activeChainId === botTestnet.id ? botTestnet : botChain;
  const { factory, registry } = getContractAddresses(activeChainId);
  const explorer = activeChain.blockExplorers.default.url;

  return (
    <footer className="proof-footer">
      <div className="proof-footer__title">Proof on {activeChain.name}</div>
      <div className="proof-footer__grid">
        <div><span>Chain ID</span><strong>{activeChainId}</strong></div>
        <div><span>Factory Address</span><a href={`${explorer}/address/${factory}`} target="_blank" rel="noreferrer"><code>{factory}</code></a></div>
        <div><span>Registry Address</span><a href={`${explorer}/address/${registry}`} target="_blank" rel="noreferrer"><code>{registry}</code></a></div>
      </div>
      <a href="https://www.botchain.ai/en/" target="_blank" rel="noreferrer">
        Built on BOT Chain ↗
      </a>
      <a href="https://x.com/useProofPlay" target="_blank" rel="noreferrer" className="proof-footer__social">
        Follow @useProofPlay on X ↗
      </a>
    </footer>
  );
}
