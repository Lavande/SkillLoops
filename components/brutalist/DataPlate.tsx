import { cn } from "@/lib/cn";
import type { ReactNode } from "react";

export function DataPlate({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="caption">{label}</span>
      <div className="plate text-sm leading-tight">{value}</div>
      {hint ? <span className="text-[10px] text-muted font-mono">{hint}</span> : null}
    </div>
  );
}
