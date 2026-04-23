"use client";

import { motion } from "framer-motion";
import { truncateId } from "@/components/brutalist/MonoId";
import { cn } from "@/lib/cn";

export interface ShareSlice {
  holder: string;
  label?: string;
  shares: number;
  isAuthor?: boolean;
}

interface Props {
  slices: ShareSlice[];
  totalShares: number;
  minAuthorRatioBps: number;
  height?: number;
  className?: string;
  annotate?: boolean;
}

const ACCENT = "#FF5B1F";
const INK = "#0B0B0B";
const TONES = ["#0B0B0B", "#FF5B1F", "#6B675E", "#1A1A1A", "#D9D4C7", "#8B8378", "#B85C2E"];

export function StackedShareBar({
  slices,
  totalShares,
  minAuthorRatioBps,
  height = 44,
  className,
  annotate = true,
}: Props) {
  const sorted = [...slices].sort((a, b) => (b.isAuthor ? 1 : 0) - (a.isAuthor ? 1 : 0) || b.shares - a.shares);
  const floorPct = minAuthorRatioBps / 100; // bps→%

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative border border-ink bg-paper-raised" style={{ height }}>
        <div className="relative flex h-full w-full">
          {sorted.map((s, i) => {
            const pct = totalShares > 0 ? (s.shares / totalShares) * 100 : 0;
            const color = s.isAuthor ? INK : s.shares === 0 ? "transparent" : TONES[(i + 1) % TONES.length] ?? ACCENT;
            return (
              <motion.div
                key={s.holder}
                initial={false}
                animate={{ width: `${pct}%` }}
                transition={{ type: "spring", stiffness: 180, damping: 22 }}
                className="h-full border-r border-ink last:border-r-0 relative overflow-hidden"
                style={{ background: color }}
                title={`${s.label ?? truncateId(s.holder)} · ${s.shares} shares · ${pct.toFixed(2)}%`}
              >
                {pct > 6 ? (
                  <div className="absolute inset-0 flex items-center px-2 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: s.isAuthor ? "#F4F1EA" : pct > 10 ? "#F4F1EA" : "#0B0B0B" }}>
                    {pct.toFixed(1)}%
                  </div>
                ) : null}
              </motion.div>
            );
          })}
        </div>
        {/* author floor tick */}
        <div
          className="absolute top-0 bottom-0 w-px bg-accent"
          style={{ left: `${floorPct}%` }}
          aria-label="Author floor"
        >
          <div className="absolute -top-5 -translate-x-1/2 caption text-accent whitespace-nowrap">
            floor {floorPct.toFixed(0)}%
          </div>
          <div className="absolute -bottom-4 -translate-x-1/2 w-2 h-2 bg-accent rotate-45" />
        </div>
      </div>

      {annotate ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 font-mono text-[11px]">
          {sorted.map((s, i) => {
            const pct = totalShares > 0 ? (s.shares / totalShares) * 100 : 0;
            const color = s.isAuthor ? INK : s.shares === 0 ? "transparent" : TONES[(i + 1) % TONES.length] ?? ACCENT;
            return (
              <li key={s.holder} className="flex items-center gap-2 min-w-0">
                <span
                  className="inline-block w-3 h-3 border border-ink flex-shrink-0"
                  style={{ background: color }}
                />
                <span className={cn("truncate", s.isAuthor && "font-semibold")}>
                  {s.label ?? truncateId(s.holder)}
                  {s.isAuthor ? " · AUTHOR" : ""}
                </span>
                <span className="ml-auto text-muted">
                  {s.shares.toLocaleString()} · {pct.toFixed(1)}%
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
