"use client";
import { txLink, type Cluster } from "@/lib/chain/explorer";

type Status = "idle" | "signing" | "confirming" | "confirmed" | "error";

export function TxStatus({ status, sig, cluster, error }:
  { status: Status; sig?: string; cluster: Cluster; error?: string }) {
  if (status === "idle") return null;
  return (
    <div className="mt-2 text-xs font-mono border border-[var(--ink)] px-2 py-1">
      {status === "signing" && "⏳ waiting for signature…"}
      {status === "confirming" && "⏳ confirming on devnet…"}
      {status === "confirmed" && sig && (
        <>✓ confirmed — <a href={txLink(sig, cluster)} target="_blank" rel="noreferrer" className="underline">view on explorer</a></>
      )}
      {status === "error" && `✕ ${error ?? "failed"}`}
    </div>
  );
}
