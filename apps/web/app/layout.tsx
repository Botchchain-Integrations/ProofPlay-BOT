import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { Web3Provider } from "@/components/providers/Web3Provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proof of Play",
  description: "BOT Chain-powered fantasy football rooms"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Web3Provider>
          <div className="app-shell">
            <header className="site-header">
              <Link href="/" className="brand">
                <span className="brand-badge">PoP</span>
                <span>Proof of Play</span>
              </Link>

              <div className="header-actions">
                <nav className="nav">
                  <Link href="/">Home</Link>
                  <Link href="/rooms">Rooms</Link>
                  <Link href="/rooms/create">Create Room</Link>
                </nav>
                <WalletButton />
              </div>
            </header>

            <main>{children}</main>
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
