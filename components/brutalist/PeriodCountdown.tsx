"use client";

import { useEffect, useState } from "react";
import { fmtTimeDelta } from "@/lib/units";

export function PeriodCountdown({
  startUnix,
  periodLength,
  onElapsed,
}: {
  startUnix: number;
  periodLength: number;
  onElapsed?: () => void;
}) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 500);
    return () => clearInterval(t);
  }, []);
  const remaining = Math.max(0, startUnix + periodLength - now);
  const progress = Math.min(1, (periodLength - remaining) / periodLength);
  useEffect(() => {
    if (remaining === 0) onElapsed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining === 0]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="caption">period window</span>
        <span className="font-mono text-sm">
          {remaining > 0 ? `T-${fmtTimeDelta(remaining)}` : "ELAPSED · ready to settle"}
        </span>
      </div>
      <div className="relative h-[10px] border border-ink bg-paper-raised">
        <div
          className="absolute left-0 top-0 bottom-0 bg-ink"
          style={{ width: `${progress * 100}%` }}
        />
        <div
          className="absolute left-0 top-0 bottom-0 bg-accent mix-blend-multiply"
          style={{ width: `${Math.max(0, progress * 100 - 92)}%`, transform: `translateX(${progress * 100 - Math.max(0, progress * 100 - 92)}%)` }}
        />
      </div>
    </div>
  );
}
