"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { MonoId } from "@/components/brutalist/MonoId";

export function ConnectButton() {
  const { publicKey, connect, disconnect, connecting, connected, wallets, select, wallet } = useWallet();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function onConnect() {
    // ensure Phantom is selected
    const phantom = wallets.find((w) => w.adapter.name === "Phantom");
    if (!wallet && phantom) select(phantom.adapter.name);
    try {
      await connect();
    } catch {
      // user probably cancelled
    }
  }

  if (!mounted) return <span className="font-mono text-[11px] text-muted">·</span>;

  if (connected && publicKey) {
    return (
      <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
        <span className="caption">wallet</span>
        <MonoId value={publicKey.toBase58()} />
        <button
          onClick={() => disconnect()}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted hover:text-accent"
        >
          disconnect
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onConnect}
      className="w-full border border-ink bg-ink px-3 py-2 text-center font-mono text-[11px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-accent hover:text-ink sm:w-auto sm:py-1.5 sm:tracking-[0.2em]"
    >
      {connecting ? "connecting…" : "Connect Phantom"}
    </button>
  );
}
