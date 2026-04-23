import { cn } from "@/lib/cn";

export function Rule({ variant = "single", className }: { variant?: "single" | "double"; className?: string }) {
  return <div className={cn(variant === "single" ? "rule-h" : "rule-h-double", className)} />;
}
