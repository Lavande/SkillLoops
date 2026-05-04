"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Chip } from "@/components/brutalist/Chip";
import { SkillLoopMotif } from "@/components/loop/SkillLoopMotif";
import { cn } from "@/lib/cn";

type PitchSlide = {
  eyebrow: string;
  caption: string;
  render: () => ReactNode;
};

const FLOW = [
  { id: "01", label: "Publish", hint: "encrypted skill", sig: "ed25519 · 3xK…7Ay" },
  { id: "02", label: "Subscribe", hint: "starts at 0%", sig: "ed25519 · 9pQ…r2L" },
  { id: "03", label: "Reflect", hint: "patch + test", sig: "ed25519 · v4N…0Bk" },
  { id: "04", label: "Judge", hint: "score + weight", sig: "ed25519 · ai/Ø…ph7" },
  { id: "05", label: "Own", hint: "future revenue", sig: "merkle · root/0x" },
];

const SLIDES: PitchSlide[] = [
  {
    eyebrow: "TITLE CARD",
    caption: "SkillLoops Protocol / opening",
    render: () => (
      <div className="grid min-h-full grid-cols-12 items-stretch gap-6">
        {/* left margin metadata column — gives the title slide a "documented" feel */}
        <aside className="col-span-12 lg:col-span-1 lg:flex lg:flex-col lg:justify-between">
          <ul className="hidden lg:block space-y-3 font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
            <MetaRow k="FILE" v="SLP-001" />
            <MetaRow k="REV" v="A · 1.0" />
            <MetaRow k="CHAIN" v="SOLANA" />
            <MetaRow k="NET" v="DEVNET" />
            <MetaRow k="DATE" v="2026-05" />
          </ul>
          <div className="hidden lg:flex flex-col gap-1 font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
            <span>SIGNED</span>
            <span className="text-ink">SLP CORE TEAM</span>
            <SignatureGlyph />
          </div>
        </aside>

        <section className="col-span-12 lg:col-span-7 flex flex-col justify-center">
          <div className="caption mb-5 flex items-center gap-3">
            <span>SOLANA HACKATHON</span>
            <span className="text-ink/30">·</span>
            <span>PRODUCT DEMO</span>
            <span className="text-ink/30">·</span>
            <span className="text-accent">CARD 01</span>
          </div>
          <h1 className="font-display text-[clamp(4rem,10vw,9.5rem)] font-bold uppercase leading-[0.86] tracking-[-0.02em]">
            SkillLoops<br />
            <span className="text-accent">Protocol</span>
            <span className="ml-2 inline-block h-[0.18em] w-[0.18em] translate-y-[-0.18em] bg-accent" />
          </h1>
          <p className="mt-7 max-w-3xl font-serif text-[clamp(1.45rem,2.4vw,2.35rem)] leading-[1.18]">
            A marketplace where AI skill users earn ownership by contributing useful
            real-world experience.
          </p>

          <div className="mt-8 flex flex-wrap items-end gap-4">
            <ChipStack tone="ink" label="LAYER 01" body="AI skills" />
            <ChipStack tone="ghost" label="LAYER 02" body="AI agents" />
            <ChipStack tone="accent" label="LAYER 03" body="AI judges" />
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-4 flex flex-col">
          <header className="flex items-center justify-between border-x border-t border-ink bg-paper-raised px-3 py-2">
            <span className="caption">FIG. 01 · LOOP DIAGRAM</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent">LIVE</span>
          </header>
          <div className="flex flex-1 items-center justify-center border border-ink bg-paper-raised p-4">
            <SkillLoopMotif size={340} active="REFLECT" />
          </div>
          <footer className="grid grid-cols-3 border-x border-b border-ink bg-paper">
            {[
              ["Ø", "336"],
              ["STAGES", "5"],
              ["REV", "1.0"],
            ].map(([k, v]) => (
              <div key={k} className="border-r border-ink last:border-r-0 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{k}</div>
                <div className="font-display text-base uppercase">{v}</div>
              </div>
            ))}
          </footer>
        </aside>
      </div>
    ),
  },

  {
    eyebrow: "PROBLEM",
    caption: "Why the market needs a loop",
    render: () => (
      <div className="flex min-h-full flex-col justify-center">
        <div className="caption mb-5 flex items-center gap-3">
          <span>TODAY</span>
          <span className="text-ink/30">·</span>
          <span>STATIC SKILL MARKET</span>
          <span className="text-ink/30">·</span>
          <span className="text-accent">3 FAILURE MODES</span>
        </div>
        <h2 className="max-w-5xl font-display text-[clamp(3.2rem,8vw,7.2rem)] font-bold uppercase leading-[0.9] tracking-[-0.02em]">
          Skills decay<br />
          <span className="text-accent">after sale</span>.
        </h2>
        <p className="mt-6 max-w-4xl font-serif text-[clamp(1.35rem,2.2vw,2.1rem)] leading-[1.22]">
          APIs move. Models change. Edge cases appear. The best signal is the failed run,
          but today it usually disappears.
        </p>

        <div className="mt-10 grid grid-cols-1 border border-ink bg-paper md:grid-cols-3">
          <ProblemCell
            no="01"
            title="Seller Ships Once"
            body="A skill leaves the author as a static file."
            glyph={<GlyphShipOnce />}
          />
          <ProblemCell
            no="02"
            title="Buyer Finds Failures"
            body="Real usage creates the strongest improvement signal."
            glyph={<GlyphLostSignal />}
          />
          <ProblemCell
            no="03"
            title="Signal Is Lost"
            body="There is no native way to price or reward the lesson."
            glyph={<GlyphDeadEnd />}
            last
          />
        </div>
      </div>
    ),
  },

  {
    eyebrow: "MECHANISM",
    caption: "The Reflection Skill turns failures into submissions",
    render: () => (
      <div className="grid min-h-full grid-cols-12 items-center gap-8">
        <section className="col-span-12 lg:col-span-7">
          <div className="caption mb-5 flex items-center gap-3">
            <span>THE LOOP</span>
            <span className="text-ink/30">·</span>
            <span>SIMPLE VERSION</span>
          </div>
          <h2 className="font-display text-[clamp(3.2rem,7.8vw,7rem)] font-bold uppercase leading-[0.9] tracking-[-0.02em]">
            Use.<br />
            Reflect.<br />
            <span className="text-accent">Submit.</span>
          </h2>

          {/* arrow micro-strip mirroring the loop's three highlighted moves */}
          <div className="mt-7 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
            <ArrowTag>USE</ArrowTag>
            <Connector />
            <ArrowTag>REFLECT</ArrowTag>
            <Connector />
            <ArrowTag accent>SUBMIT</ArrowTag>
          </div>

          <p className="mt-7 max-w-3xl font-serif text-[clamp(1.35rem,2.1vw,2rem)] leading-[1.24]">
            The Reflection Skill turns a failed agent run into root cause, a concrete
            patch, and a reproducible test case.
          </p>
        </section>

        <aside className="col-span-12 border border-ink bg-paper lg:col-span-5">
          <header className="flex items-center justify-between border-b border-ink px-4 py-3">
            <span className="caption">ExperienceBundle.json</span>
            <Chip tone="accent">schema valid</Chip>
          </header>
          <div className="flex items-center justify-between border-b border-ink bg-paper-raised px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
            <span>POST /submit</span>
            <span>200 · 142 ms</span>
          </div>
          <pre className="max-h-[480px] overflow-hidden bg-ink p-5 font-mono text-[12px] leading-6 text-paper">
            <CodeLine no={1} text='{' />
            <CodeLine no={2} k='"failure_mode"' v='"missed Rust unsafe risk"' comma />
            <CodeLine no={3} k='"root_cause_analysis"' v='"the skill has no' />
            <CodeLine no={4} text='    language-specific safety branch",' />
            <CodeLine no={5} k='"proposed_patch"' raw='{' />
            <CodeLine no={6} k='"type"' v='"new_step"' indent comma />
            <CodeLine no={7} k='"target_section"' v='"Review checklist"' indent />
            <CodeLine no={8} text='  },' />
            <CodeLine no={9} k='"test_case"' v='"PR with unsafe block"' />
            <CodeLine no={10} text='}' />
          </pre>
        </aside>
      </div>
    ),
  },

  {
    eyebrow: "PROTOCOL PROOF",
    caption: "Signed actions, permanent records, shared revenue",
    render: () => (
      <div className="flex min-h-full flex-col justify-center">
        <div className="caption mb-5 flex items-center gap-3">
          <span>WHAT CHANGES STATE</span>
          <span className="text-ink/30">·</span>
          <span className="text-accent">5 SIGNED MOVES</span>
        </div>
        <h2 className="max-w-6xl font-display text-[clamp(3rem,7vw,6.4rem)] font-bold uppercase leading-[0.92] tracking-[-0.02em]">
          Signed actions.<br />
          <span className="text-accent">Permanent records.</span><br />
          Shared revenue.
        </h2>

        <div className="mt-10 relative grid grid-cols-1 border border-ink bg-paper md:grid-cols-5">
          {FLOW.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "relative flex min-h-[200px] flex-col p-4",
                index < FLOW.length - 1 && "border-b border-ink md:border-b-0 md:border-r"
              )}
            >
              <div className="flex items-baseline justify-between">
                <div className="font-display text-4xl font-semibold leading-none text-accent">
                  {step.id}
                </div>
                {index < FLOW.length - 1 && (
                  <span className="hidden md:inline font-mono text-[14px] leading-none text-ink/40">
                    →
                  </span>
                )}
              </div>
              <div className="mt-8 font-display text-xl font-semibold uppercase tracking-[0.06em]">
                {step.label}
              </div>
              <div className="mt-2 font-mono text-[11px] uppercase leading-5 tracking-[0.1em] text-muted">
                {step.hint}
              </div>
              <div className="mt-auto pt-4 border-t border-ink/15 font-mono text-[9px] uppercase leading-4 tracking-[0.16em] text-ink/60">
                <span className="text-accent">∎ </span>
                {step.sig}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.22em] text-muted">
          <span>EACH MOVE WRITES TO ARWEAVE · IRREVERSIBLE</span>
          <span>CHAIN ↦ SOLANA / DEVNET</span>
        </div>
      </div>
    ),
  },

  {
    eyebrow: "CLOSING",
    caption: "Failures become ownership",
    render: () => (
      <div className="grid min-h-full grid-cols-12 items-center gap-8">
        <section className="col-span-12 lg:col-span-7">
          <div className="caption mb-5 flex items-center gap-3">
            <span>OUTCOME</span>
            <span className="text-ink/30">·</span>
            <span>THE LOOP CLOSES</span>
            <span className="text-ink/30">·</span>
            <span className="text-accent">CARD 05/05</span>
          </div>
          <h2 className="font-display text-[clamp(3.5rem,8.6vw,7.8rem)] font-bold uppercase leading-[0.88] tracking-[-0.02em]">
            Failures become<br />
            <span className="text-accent">ownership</span>.
          </h2>
          <p className="mt-7 max-w-3xl font-serif text-[clamp(1.35rem,2.2vw,2.1rem)] leading-[1.24]">
            SkillLoops turns real agent experience into an improvement path, an audit
            trail, and an economic stake.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <Link
              href="/market"
              className="border border-ink bg-paper px-3 py-1.5 text-ink hover:bg-ink hover:text-paper transition-colors"
            >
              Enter market →
            </Link>
            <Link
              href="/deck"
              className="border border-ink bg-paper px-3 py-1.5 text-ink hover:bg-ink hover:text-paper transition-colors"
            >
              Long deck →
            </Link>
            <span className="text-ink/40">·</span>
            <span>skillloops.xyz</span>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-5">
          <div className="border border-ink bg-paper-raised">
            <header className="flex items-center justify-between border-b border-ink px-4 py-3">
              <span className="caption">FINAL STATE</span>
              <Chip tone="accent">closed loop</Chip>
            </header>
            <div className="grid grid-cols-[1fr_120px]">
              <div className="divide-y divide-ink/20 border-r border-ink/15 p-4">
                <ProofRow
                  mark="01"
                  title="Failure captured"
                  body="The failed run is no longer discarded."
                />
                <ProofRow
                  mark="02"
                  title="Usefulness scored"
                  body="The judge turns quality into contribution weight."
                />
                <ProofRow
                  mark="03"
                  title="Skill evolves"
                  body="The next version carries contributor history forward."
                />
              </div>
              <div className="flex items-center justify-center p-3">
                <ClosedLoopGlyph />
              </div>
            </div>
            <footer className="border-t border-ink px-4 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted flex items-center justify-between">
              <span>SIGNED · v1.0 · SLP CORE</span>
              <ClosedStamp />
            </footer>
          </div>
        </aside>
      </div>
    ),
  },
];

export default function PitchPage() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [clock, setClock] = useState("--:--:--");
  const total = SLIDES.length;
  const slide = SLIDES[index];

  const go = useCallback(
    (nextIndex: number) => {
      setIndex((current) => {
        const next = Math.max(0, Math.min(total - 1, nextIndex));
        setDirection(next >= current ? 1 : -1);
        return next;
      });
    },
    [total]
  );

  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
      if (event.key === "ArrowRight" || event.key === "PageDown" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft" || event.key === "PageUp" || event.key === "Backspace") {
        event.preventDefault();
        prev();
      } else if (event.key === "Home") {
        go(0);
      } else if (event.key === "End") {
        go(total - 1);
      } else if (/^[1-5]$/.test(event.key)) {
        go(Number(event.key) - 1);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, next, prev, total]);

  useEffect(() => {
    const match = window.location.hash.match(/^#(\d+)$/);
    if (match) go(Number(match[1]) - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    history.replaceState(null, "", `#${index + 1}`);
  }, [index]);

  // ticking clock for the broadcast-style header
  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };
    setClock(fmt());
    const id = setInterval(() => setClock(fmt()), 1000);
    return () => clearInterval(id);
  }, []);

  const progress = useMemo(() => `${((index + 1) / total) * 100}%`, [index, total]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-paper text-ink bp-grid-dots">
      <DraftWatermark />

      <header className="shrink-0 border-b border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-frame items-center justify-between gap-6 px-6 py-3">
          <Link href="/" className="flex items-center gap-3">
            <PitchGlyph />
            <div className="font-display text-sm font-semibold uppercase leading-none tracking-[0.14em]">
              Skill Loops <span className="text-accent">// Pitch</span>
            </div>
          </Link>
          <div className="hidden items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted md:flex">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              REC
            </span>
            <span className="text-ink/30">·</span>
            <span className="tabular-nums">{clock}</span>
            <span className="text-ink/30">·</span>
            <span>{slide.caption}</span>
          </div>
          <span className="plate font-mono text-[11px]">
            FRAME {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
        <div className="h-[2px] bg-ink/10">
          <div className="h-full bg-accent transition-[width] duration-300" style={{ width: progress }} />
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.section
            key={index}
            custom={direction}
            initial={{ opacity: 0, x: direction * 34 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -direction * 34 }}
            transition={{ duration: 0.34, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute inset-0 overflow-auto"
          >
            <div className="mx-auto flex min-h-full max-w-frame flex-col px-6 py-8 md:px-12 lg:px-16">
              <div className="mb-5 flex items-baseline justify-between gap-6">
                <div className="flex min-w-0 flex-wrap items-baseline gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
                    § {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
                    {slide.eyebrow}
                  </span>
                </div>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-muted md:inline">
                  SLP VIDEO CARDS · v1.0 · A
                </span>
              </div>
              <div className="flex-1">{slide.render()}</div>
            </div>
          </motion.section>
        </AnimatePresence>

        <button
          aria-label="Previous pitch card"
          disabled={index === 0}
          onClick={prev}
          className="absolute left-0 top-0 h-full w-[11%] cursor-w-resize disabled:cursor-default"
        />
        <button
          aria-label="Next pitch card"
          disabled={index === total - 1}
          onClick={next}
          className="absolute right-0 top-0 h-full w-[11%] cursor-e-resize disabled:cursor-default"
        />
      </main>

      <footer className="shrink-0 border-t border-ink bg-paper">
        <div className="mx-auto flex max-w-frame items-center justify-between gap-4 px-6 py-3">
          <div className="hidden truncate font-mono text-[10px] uppercase tracking-[0.2em] text-muted md:block">
            {slide.caption}
          </div>
          <div className="flex flex-1 items-center justify-center gap-1.5">
            {SLIDES.map((s, dotIndex) => (
              <button
                key={s.eyebrow}
                type="button"
                title={`${dotIndex + 1}. ${s.caption}`}
                aria-label={`Go to pitch card ${dotIndex + 1}`}
                onClick={() => go(dotIndex)}
                className={cn(
                  "h-2 border border-ink transition-all",
                  dotIndex === index ? "w-7 bg-accent" : dotIndex < index ? "w-2 bg-ink" : "w-2 bg-paper"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <NavButton onClick={prev} disabled={index === 0}>←</NavButton>
            <NavButton onClick={next} disabled={index === total - 1}>→</NavButton>
          </div>
        </div>
      </footer>

      <CornerMarks />
    </div>
  );
}

function MetaRow({ k, v }: { k: string; v: string }) {
  return (
    <li className="flex flex-col gap-0.5">
      <span className="text-ink/45">{k}</span>
      <span className="text-ink">{v}</span>
    </li>
  );
}

function ChipStack({ tone, label, body }: { tone: "ink" | "ghost" | "accent"; label: string; body: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted">{label}</span>
      <Chip tone={tone}>{body}</Chip>
    </div>
  );
}

function ProblemCell({
  no,
  title,
  body,
  glyph,
  last = false,
}: {
  no: string;
  title: string;
  body: string;
  glyph?: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn("relative flex min-h-[200px] flex-col p-5", !last && "border-b border-ink md:border-b-0 md:border-r")}>
      <div className="flex items-start justify-between">
        <div className="font-display text-5xl font-semibold leading-none text-accent">{no}</div>
        <div className="text-ink/70">{glyph}</div>
      </div>
      <h3 className="mt-6 font-display text-2xl font-semibold uppercase leading-none tracking-[0.06em]">{title}</h3>
      <p className="mt-3 font-mono text-[12px] uppercase leading-5 tracking-[0.1em] text-muted">{body}</p>
    </div>
  );
}

function ProofRow({ mark, title, body }: { mark: string; title: string; body: string }) {
  return (
    <div className="grid grid-cols-[3rem_1fr] gap-4 py-5 first:pt-1 last:pb-1">
      <div className="font-display text-4xl font-semibold leading-none text-accent">{mark}</div>
      <div>
        <div className="font-display text-xl font-semibold uppercase leading-none tracking-[0.06em]">{title}</div>
        <div className="mt-2 font-mono text-[11px] uppercase leading-5 tracking-[0.1em] text-muted">{body}</div>
      </div>
    </div>
  );
}

function NavButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="inline-flex h-9 w-9 items-center justify-center border border-ink bg-paper font-mono text-base transition-colors hover:bg-ink hover:text-paper disabled:cursor-not-allowed disabled:opacity-30"
    />
  );
}

function PitchGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true" className="shrink-0">
      <circle cx="13" cy="13" r="10" stroke="currentColor" fill="none" />
      <circle cx="13" cy="3" r="2" fill="currentColor" />
      <circle cx="23" cy="13" r="1.5" fill="currentColor" />
      <circle cx="13" cy="23" r="1.5" fill="currentColor" />
      <circle cx="3" cy="13" r="1.5" fill="currentColor" />
      <circle cx="20" cy="6" r="1.5" fill="currentColor" />
      <path d="M 13 3 A 10 10 0 0 1 23 13" stroke="#FF5B1F" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function CornerMarks() {
  return (
    <>
      <div className="pointer-events-none fixed left-3 top-[60px] h-3 w-3 border-l border-t border-ink/30" />
      <div className="pointer-events-none fixed right-3 top-[60px] h-3 w-3 border-r border-t border-ink/30" />
      <div className="pointer-events-none fixed bottom-[60px] left-3 h-3 w-3 border-b border-l border-ink/30" />
      <div className="pointer-events-none fixed bottom-[60px] right-3 h-3 w-3 border-b border-r border-ink/30" />
    </>
  );
}

function DraftWatermark() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center select-none"
    >
      <span
        className="font-display text-[22vw] font-bold uppercase tracking-[0.2em] text-ink/[0.025] -rotate-12 whitespace-nowrap"
        style={{ letterSpacing: "0.4em" }}
      >
        SLP · DRAFT
      </span>
    </div>
  );
}

function SignatureGlyph() {
  return (
    <svg width="60" height="22" viewBox="0 0 60 22" aria-hidden className="text-ink/70">
      <path
        d="M 2 14 C 8 4, 14 22, 20 12 S 30 4, 36 14 S 50 18, 58 8"
        stroke="currentColor"
        strokeWidth="0.8"
        fill="none"
      />
      <line x1="2" y1="20" x2="58" y2="20" stroke="currentColor" strokeWidth="0.4" strokeDasharray="1 2" />
    </svg>
  );
}

/* ── slide-03 helpers ──────────────────────────────────────────────────── */

function ArrowTag({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-ink px-2 py-1",
        accent ? "bg-accent text-ink" : "bg-paper text-ink"
      )}
    >
      {children}
    </span>
  );
}

function Connector() {
  return (
    <span aria-hidden className="inline-flex items-center text-ink/40">
      <span className="block h-px w-6 bg-current" />
      <span className="-ml-[3px]">▸</span>
    </span>
  );
}

function CodeLine({
  no,
  k,
  v,
  text,
  raw,
  comma,
  indent,
}: {
  no: number;
  k?: string;
  v?: string;
  text?: string;
  /** rendered after the `key:` colon — for object/array openers like `{` */
  raw?: string;
  comma?: boolean;
  indent?: boolean;
}) {
  return (
    <div className="flex">
      <span className="mr-3 inline-block w-5 select-none text-paper/30">{String(no).padStart(2, "0")}</span>
      <span className="flex-1">
        {indent && <span>  </span>}
        {k && (
          <>
            <span className="text-paper/55">  </span>
            <span className="text-accent">{k}</span>
            <span className="text-paper/55">: </span>
          </>
        )}
        {v && <span className="text-paper">{v}</span>}
        {raw && <span className="text-paper">{raw}</span>}
        {text && !k && <span className="text-paper">{text}</span>}
        {comma && <span className="text-paper/55">,</span>}
      </span>
    </div>
  );
}

/* ── slide-02 glyphs (each ~ 40px, mono blueprint) ─────────────────────── */

function GlyphShipOnce() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <rect x="4" y="14" width="20" height="16" />
      <line x1="4" y1="20" x2="24" y2="20" />
      <line x1="24" y1="22" x2="40" y2="22" strokeDasharray="2 3" />
      <polyline points="36,18 40,22 36,26" />
      <circle cx="14" cy="25" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

function GlyphLostSignal() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <circle cx="10" cy="22" r="3" />
      <circle cx="34" cy="22" r="3" />
      <line x1="13" y1="22" x2="20" y2="22" />
      <line x1="24" y1="22" x2="31" y2="22" strokeDasharray="2 2" />
      <line x1="20" y1="14" x2="24" y2="30" stroke="#FF5B1F" strokeWidth="1.6" />
      <line x1="24" y1="14" x2="20" y2="30" stroke="#FF5B1F" strokeWidth="1.6" />
    </svg>
  );
}

function GlyphDeadEnd() {
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <line x1="4" y1="22" x2="28" y2="22" />
      <polyline points="24,18 28,22 24,26" />
      <line x1="32" y1="10" x2="32" y2="34" strokeWidth="1.6" />
      <line x1="35" y1="10" x2="35" y2="34" strokeDasharray="2 2" />
    </svg>
  );
}

function ClosedLoopGlyph() {
  // self-contained mini loop: 5 dots round a circle with a single accent arc
  // and a centered ✓ — visually says "the loop closed" without overflowing labels.
  const size = 96;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const stages = [0, 72, 144, 216, 288];
  const polar = (deg: number) => {
    const rad = (deg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="text-ink">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth="0.8" />
      <circle cx={cx} cy={cy} r={r - 8} fill="none" stroke="currentColor" strokeWidth="0.4" strokeDasharray="2 3" />
      {/* accent arc covering the last quarter */}
      <path
        d={`M ${polar(216).x} ${polar(216).y} A ${r} ${r} 0 0 1 ${polar(360).x} ${polar(360).y}`}
        stroke="#FF5B1F"
        strokeWidth="1.4"
        fill="none"
      />
      {stages.map((deg, i) => {
        const p = polar(deg);
        return (
          <circle
            key={deg}
            cx={p.x}
            cy={p.y}
            r={i === 4 ? 3 : 2}
            fill={i === 4 ? "#FF5B1F" : "currentColor"}
          />
        );
      })}
      <text
        x={cx}
        y={cy + 4}
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize="11"
        fontWeight="600"
        fill="#FF5B1F"
      >
        ✓
      </text>
    </svg>
  );
}

function ClosedStamp() {
  return (
    <span
      className="inline-flex items-center border border-accent px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.24em] text-accent -rotate-3"
      style={{ letterSpacing: "0.3em" }}
    >
      ✓ closed
    </span>
  );
}
