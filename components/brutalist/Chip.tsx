import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

type Tone = "ink" | "accent" | "muted" | "ghost";

const map: Record<Tone, string> = {
  ink: "bg-ink text-paper border-ink",
  accent: "bg-accent text-ink border-ink",
  muted: "bg-paper-raised text-ink/80 border-ink/30",
  ghost: "bg-transparent text-ink border-ink",
};

export function Chip({ tone = "muted", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-[2px] border font-mono text-[10px] uppercase tracking-[0.18em]",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
