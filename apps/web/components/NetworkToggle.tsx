"use client";

import { useEffect } from "react";
import { useChainId, useConfig } from "wagmi";
import { switchChain } from "wagmi/actions";
import { botChain, botTestnet } from "@/lib/chains";
import { CHAIN_COOKIE } from "@/lib/contracts";

// Chain id from the document.cookie, or undefined when unset/invalid.
function readCookieChainId() {
  const raw = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${CHAIN_COOKIE}=`));
  if (!raw) return undefined;
  const value = raw.slice(CHAIN_COOKIE.length + 1);
  return /^\d+$/.test(value) ? Number(value) : undefined;
}

// Segmented mainnet/testnet switch shown in the navbar.
// Switches the active wagmi chain and stores the preference in a cookie so
// server components read the same network (see lib/server/network.ts).
export default function NetworkToggle() {
  const activeChainId = useChainId();
  const wagmiConfig = useConfig();

  // Restore the user's selected network on reload (wagmi starts on mainnet).
  useEffect(() => {
    const cookieChainId = readCookieChainId();
    if (cookieChainId && cookieChainId !== activeChainId) {
      switchChain(wagmiConfig, { chainId: cookieChainId }).catch((error) => {
        console.error("Failed to restore network:", error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = async (chainId: number) => {
    if (chainId === activeChainId) return;
    document.cookie = `${CHAIN_COOKIE}=${chainId}; path=/; max-age=31536000`;
    try {
      await switchChain(wagmiConfig, { chainId });
    } catch (error) {
      // Fallback: the next page/tab load will pick up the cookie.
      console.error("Failed to switch chain:", error);
    }
  };

  const options = [
    { id: botTestnet.id, label: "TESTNET", activeClass: "bg-[#10A37F] text-black" },
    { id: botChain.id, label: "MAINNET", activeClass: "bg-[#15DCAC] text-black" }
  ];

  return (
    <div
      className="network-toggle"
      role="group"
      aria-label="Select network"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => handleSelect(option.id)}
          className={`network-toggle__button ${activeChainId === option.id ? "is-active" : ""} ${
            option.id === botTestnet.id ? "is-testnet" : "is-mainnet"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
