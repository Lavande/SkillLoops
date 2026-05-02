"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

export function truncateId(v: string, lead = 4, tail = 4): string {
  if (!v) return "";
  if (v.length <= lead + tail + 2) return v;
  return `${v.slice(0, lead)}…${v.slice(-tail)}`;
}

export function MonoId({
  value,
  lead = 4,
  tail = 4,
  prefix,
  className,
  copyable = true,
}: {
  value: string;
  lead?: number;
  tail?: number;
  prefix?: string;
  className?: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  async function onCopy() {
    if (!copyable) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex max-w-full items-center gap-1 border border-ink/30 px-2 py-0.5 font-mono text-xs hover:border-ink",
        copyable ? "cursor-copy" : "cursor-default",
        className
      )}
      title={copyable ? `${value} — click to copy` : value}
    >
      {prefix ? <span className="text-muted">{prefix}</span> : null}
      <span className="min-w-0 truncate">{truncateId(value, lead, tail)}</span>
      {copyable ? (
        <span className="text-[9px] uppercase tracking-[0.18em] text-muted">
          {copied ? "ok" : "cp"}
        </span>
      ) : null}
    </button>
  );
}
