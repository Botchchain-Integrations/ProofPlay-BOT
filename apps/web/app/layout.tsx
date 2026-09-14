import "@rainbow-me/rainbowkit/styles.css";
import type { Metadata } from "next";
import { Sora } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { Web3Provider } from "@/components/providers/Web3Provider";
import { ProofFooter } from "@/components/ProofFooter";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora"
});

export const metadata: Metadata = {
  title: "ProofPlay Fantasy",
  description: "BOT Chain-powered fantasy football rooms"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={sora.variable}>
      <body className="antialiased" style={{ fontFamily: "var(--font-sora), sans-serif" }}>
        <Web3Provider>
          <div className="app-shell">
            <Navbar />
            <main className="page">{children}</main>
            <ProofFooter />
          </div>
        </Web3Provider>
      </body>
    </html>
  );
}
