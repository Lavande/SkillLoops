"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ConnectButton } from "@/components/phantom/ConnectButton";

export function SiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // The /demo deck takes over the viewport — render bare so the slides own the screen.
  if (pathname?.startsWith("/demo")) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bp-grid-dots">
      <header className="border-b border-ink bg-paper/95 backdrop-blur">
        <div className="max-w-frame mx-auto px-6 py-4 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3">
            <LoopGlyph />
            <div className="font-display text-lg uppercase tracking-[0.14em]">
              Skill Loops <span className="text-accent">// Protocol</span>
            </div>
          </Link>
          <nav className="flex items-center gap-6 font-mono text-[11px] uppercase tracking-[0.18em]">
            <Link href="/market" className="accent-underline">Market</Link>
            <Link href="/publish" className="accent-underline">Publish</Link>
            <Link href="/submit" className="accent-underline">Submit</Link>
            <Link href="/reflection-skill" className="accent-underline">Reflection</Link>
            <Link href="/console" className="accent-underline">Console</Link>
            <Link href="/me" className="accent-underline">Me</Link>
          </nav>
          <ConnectButton />
        </div>
      </header>
      <main className="max-w-frame mx-auto px-6 pt-6 pb-24">{children}</main>
      <footer className="border-t border-ink bg-paper">
        <div className="max-w-frame mx-auto px-6 py-4 font-mono text-[10px] uppercase tracking-[0.2em] text-muted flex items-center justify-between">
          <span>SLP / frontend shell / mock backend</span>
          <span>sig: SIGNED · net: DEVNET-MOCK</span>
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
