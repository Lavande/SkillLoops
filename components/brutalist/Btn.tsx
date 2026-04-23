import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";

type Variant = "primary" | "ghost" | "ink";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  mono?: boolean;
  children: ReactNode;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-ink border border-ink hover:bg-ink hover:text-paper transition-colors",
  ink: "bg-ink text-paper border border-ink hover:bg-accent hover:text-ink transition-colors",
  ghost:
    "bg-paper text-ink border border-ink hover:bg-ink hover:text-paper transition-colors",
};

export const Btn = forwardRef<HTMLButtonElement, Props>(function Btn(
  { variant = "primary", mono = true, className, children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 uppercase tracking-[0.18em] text-[11px] disabled:opacity-40 disabled:cursor-not-allowed",
        mono ? "font-mono" : "font-display",
        styles[variant],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
