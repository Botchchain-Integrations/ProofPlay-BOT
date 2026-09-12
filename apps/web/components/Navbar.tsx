"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletButton } from "@/components/WalletButton";
import NetworkToggle from "@/components/NetworkToggle";

const links = [
  { href: "/", label: "Home" },
  { href: "/rooms", label: "Rooms" },
  { href: "/rooms/create", label: "Create" }
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="site-nav">
      <div className="site-nav__inner">
        <Link href="/" className="brand">
          <img src="/logo.svg" alt="ProofPlay" />
          <span>
            ProofPlay <span className="text-gradient">Fantasy</span>
          </span>
        </Link>

        <div className="header-actions">
          <NetworkToggle />
          <nav className="nav">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname.startsWith(link.href + "/");

              return (
                <Link key={link.href} href={link.href} className={active ? "is-active" : ""}>
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}