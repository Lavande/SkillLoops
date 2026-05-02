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
        "inline-flex min-h-10 items-center justify-center gap-2 px-4 py-2 text-center uppercase tracking-[0.16em] text-[11px] leading-tight disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:tracking-[0.18em]",
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
