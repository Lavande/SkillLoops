"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConnectButton } from "@/components/phantom/ConnectButton";

export function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  const networkLabel = cluster === "mainnet-beta" ? "mainnet" : cluster;
  // Presentation routes take over the viewport so the slides own the screen.
  if (pathname?.startsWith("/deck") || pathname?.startsWith("/pitch")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen overflow-x-clip bp-grid-dots">
      <header className="border-b border-ink bg-paper/95 backdrop-blur">
        <div className="max-w-frame mx-auto px-4 sm:px-6 py-3 sm:py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
          <Link href="/" className="flex min-w-0 items-center gap-3 self-start">
            <LoopGlyph />
            <div className="font-display text-base sm:text-lg uppercase tracking-[0.1em] sm:tracking-[0.14em] leading-tight">
              Skill Loops <span className="text-accent">// Protocol</span>
            </div>
          </Link>
          <nav className="w-full overflow-x-auto font-mono text-[11px] uppercase tracking-[0.13em] sm:tracking-[0.16em] lg:w-auto lg:tracking-[0.18em]">
            <div className="flex min-w-full flex-wrap items-center gap-x-4 gap-y-2 pb-1 lg:w-max lg:min-w-0 lg:flex-nowrap lg:gap-6 lg:pb-0">
              <Link href="/market" className="accent-underline whitespace-nowrap">Market</Link>
              <Link href="/publish" className="accent-underline whitespace-nowrap">Publish</Link>
              <Link href="/submit" className="accent-underline whitespace-nowrap">Submit</Link>
              <Link href="/reflection-skill" className="accent-underline whitespace-nowrap">Reflection</Link>
              <Link href="/deck" className="accent-underline whitespace-nowrap">Deck</Link>
              <Link href="/pitch" className="accent-underline whitespace-nowrap">Pitch</Link>
              <Link href="/me" className="accent-underline whitespace-nowrap">Me</Link>
            </div>
          </nav>
          <ConnectButton />
        </div>
      </header>
      <main className="max-w-frame mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-20 sm:pb-24">{children}</main>
      <footer className="border-t border-ink bg-paper">
        <div className="max-w-frame mx-auto px-4 sm:px-6 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:py-5 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] font-mono text-[10px] uppercase tracking-[0.16em] sm:tracking-[0.2em] text-muted flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <span>Copyright 2026 Skill Loops Protocol</span>
          <span>System operational · network: {networkLabel}</span>
        </div>
      </footer>
    </div>
  );
}

function LoopGlyph() {
  // A tiny blueprint glyph that matches the SkillLoopMotif
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
      <circle cx="13" cy="13" r="10" stroke="currentColor" fill="none" />
      <circle cx="13" cy="3" r="2" fill="currentColor" />
      <circle cx="23" cy="13" r="1.5" fill="currentColor" />
      <circle cx="13" cy="23" r="1.5" fill="currentColor" />
      <circle cx="3" cy="13" r="1.5" fill="currentColor" />
      <circle cx="20" cy="6" r="1.5" fill="currentColor" />
      <path d="M 13 3 A 10 10 0 0 1 23 13" stroke="#FF5B1F" strokeWidth="1.5" fill="none" />
    </svg>
  );
}
