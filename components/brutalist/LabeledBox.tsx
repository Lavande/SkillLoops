import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

interface Props {
  title: string;
  code?: string; // small monospace tag shown right of the title
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
  tone?: "paper" | "raised";
}

export function LabeledBox({ title, code, right, children, className, padded = true, tone = "paper" }: Props) {
  return (
    <section
      className={cn(
        "relative border border-ink",
        tone === "raised" ? "bg-paper-raised" : "bg-paper",
        className
      )}
    >
      <header className="flex items-center justify-between border-b border-ink">
        <div className="flex items-center gap-3 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">┌─[</span>
          <h3 className="font-display text-sm font-semibold uppercase tracking-[0.08em]">{title}</h3>
          {code ? <span className="plate text-[10px] py-[2px] px-2">{code}</span> : null}
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">]</span>
        </div>
        {right ? <div className="px-3 py-2 font-mono text-[11px]">{right}</div> : null}
      </header>
      <div className={cn(padded && "p-5")}>{children}</div>
    </section>
  );
}
