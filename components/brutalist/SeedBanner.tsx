"use client";

import { useState } from "react";
import { Btn } from "./Btn";

export function SeedBanner({ onSeeded }: { onSeeded?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function seed() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/seed", { method: "POST" });
      if (!r.ok) throw new Error(`seed failed (${r.status})`);
      setDone(true);
      onSeeded?.();
    } catch (e: any) {
      setErr(e?.message ?? "seed failed");
    } finally {
      setBusy(false);
    }
  }
  if (done) {
    return (
      <div className="border border-ink bg-paper-raised px-4 py-3 font-mono text-xs flex items-center justify-between">
        <span>seed ✓ — reload to see demo state</span>
        <button className="accent-underline" onClick={() => location.reload()}>reload</button>
      </div>
    );
  }
  return (
    <div className="border border-ink bg-paper-raised px-4 py-3 flex items-center justify-between gap-4">
      <div className="font-mono text-xs text-muted">
        <span className="text-ink">no data yet.</span> seed the demo with Alice's "GitHub PR Review" skill + a sample market.
      </div>
      <div className="flex items-center gap-2">
        {err ? <span className="caption text-accent">err: {err}</span> : null}
        <Btn variant="primary" onClick={seed} disabled={busy}>
          {busy ? "seeding…" : "Seed demo"}
        </Btn>
      </div>
    </div>
  );
}
