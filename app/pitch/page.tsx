"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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
    eyebrow: "COLD OPEN",
    caption: "Skill Loops Protocol / cold open",
    render: () => <ColdOpenSlide />,
  },

  {
    eyebrow: "TITLE CARD",
    caption: "SkillLoops Protocol / opening",
    render: () => (
      <div className="grid min-h-full grid-cols-12 items-stretch gap-6">
        <section className="col-span-12 lg:col-span-7 flex flex-col justify-center">
          <motion.div
            className="caption mb-5 flex items-center gap-3"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span>SOLANA HACKATHON</span>
            <span className="text-ink/30">·</span>
            <span className="text-accent">DEMO</span>
          </motion.div>
          <motion.h1
            className="font-display text-[clamp(3rem,7.5vw,7rem)] font-bold uppercase leading-[0.88] tracking-[-0.02em] break-words"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.1 }}
          >
            SkillLoops<br />
            <span className="text-accent">Protocol</span>
            <span className="ml-2 inline-block h-[0.18em] w-[0.18em] translate-y-[-0.18em] bg-accent" />
          </motion.h1>
          <motion.p
            className="mt-8 max-w-3xl font-serif text-[clamp(1.55rem,2.6vw,2.5rem)] leading-[1.18]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.35 }}
          >
            Use a skill. Improve it. <span className="text-accent">Own a piece of it.</span>
          </motion.p>
        </section>

        <aside className="col-span-12 lg:col-span-5 flex flex-col">
          <header className="flex items-center justify-between border-x border-t border-ink bg-paper-raised px-3 py-2">
            <span className="caption">FIG. 01 · LOOP</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent">LIVE</span>
          </header>
          <div className="flex flex-1 items-center justify-center border border-ink bg-paper-raised p-4">
            <SkillLoopMotif size={360} active="REFLECT" />
          </div>
        </aside>
      </div>
    ),
  },

  {
    eyebrow: "PROBLEM",
    caption: "Skills decay after sale",
    render: () => (
      <div className="flex min-h-full flex-col justify-center">
        <motion.div
          className="caption mb-5 flex items-center gap-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span>TODAY</span>
          <span className="text-ink/30">·</span>
          <span className="text-accent">THE PROBLEM</span>
        </motion.div>
        <motion.h2
          className="max-w-5xl font-display text-[clamp(3.6rem,9vw,8rem)] font-bold uppercase leading-[0.9] tracking-[-0.02em]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.08 }}
        >
          Skills decay<br />
          <span className="text-accent">after sale</span>.
        </motion.h2>

        <motion.div
          className="mt-12 grid grid-cols-1 border border-ink bg-paper md:grid-cols-3"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12, delayChildren: 0.35 } },
          }}
        >
          <ProblemCell no="01" title="Ship once" glyph={<GlyphShipOnce />} />
          <ProblemCell no="02" title="Fail in the wild" glyph={<GlyphLostSignal />} />
          <ProblemCell no="03" title="Signal lost" glyph={<GlyphDeadEnd />} last />
        </motion.div>
      </div>
    ),
  },

  {
    eyebrow: "THE LOOP",
    caption: "Use → Reflect → Submit → Judge → Own",
    render: () => (
      <div className="flex min-h-full flex-col justify-center">
        <motion.div
          className="caption mb-5 flex items-center gap-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span>OUR FIX</span>
          <span className="text-ink/30">·</span>
          <span className="text-accent">ONE LOOP</span>
        </motion.div>
        <motion.h2
          className="font-display text-[clamp(3.6rem,9vw,8rem)] font-bold uppercase leading-[0.9] tracking-[-0.02em]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.08 }}
        >
          Close <span className="text-accent">the loop</span>.
        </motion.h2>

        <motion.div
          className="mt-12 flex flex-wrap items-center gap-2 font-mono text-[12px] uppercase tracking-[0.18em]"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.12, delayChildren: 0.3 } },
          }}
        >
          <StageTag label="USE" />
          <StageArrow />
          <StageTag label="REFLECT" />
          <StageArrow />
          <StageTag label="SUBMIT" />
          <StageArrow />
          <StageTag label="JUDGE" />
          <StageArrow />
          <StageTag label="OWN" accent />
        </motion.div>
      </div>
    ),
  },

  {
    eyebrow: "PROOF",
    caption: "Five signed moves on Solana",
    render: () => (
      <div className="flex min-h-full flex-col justify-center">
        <motion.div
          className="caption mb-5 flex items-center gap-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span>ON-CHAIN</span>
          <span className="text-ink/30">·</span>
          <span className="text-accent">5 SIGNED MOVES</span>
        </motion.div>
        <motion.h2
          className="max-w-6xl font-display text-[clamp(3.4rem,8vw,7.2rem)] font-bold uppercase leading-[0.9] tracking-[-0.02em]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.08 }}
        >
          Every move<br />
          <span className="text-accent">is signed</span>.
        </motion.h2>

        <motion.div
          className="mt-12 relative grid grid-cols-1 border border-ink bg-paper md:grid-cols-5"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
          }}
        >
          {FLOW.map((step, index) => (
            <motion.div
              key={step.id}
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
              }}
              className={cn(
                "relative flex min-h-[170px] flex-col p-4",
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
              <div className="mt-auto font-display text-xl font-semibold uppercase tracking-[0.06em]">
                {step.label}
              </div>
              <div className="mt-1 font-mono text-[10px] uppercase leading-4 tracking-[0.16em] text-ink/60">
                <span className="text-accent">∎ </span>
                {step.sig}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    ),
  },

  {
    eyebrow: "CLOSING",
    caption: "Failures become ownership",
    render: () => (
      <div className="flex min-h-full flex-col justify-center">
        <motion.div
          className="caption mb-5 flex items-center gap-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span>OUTCOME</span>
          <span className="text-ink/30">·</span>
          <span className="text-accent">THE LOOP CLOSES</span>
        </motion.div>
        <motion.h2
          className="font-display text-[clamp(4rem,10vw,9.6rem)] font-bold uppercase leading-[0.86] tracking-[-0.02em]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.08 }}
        >
          Failures become<br />
          <motion.span
            className="text-accent inline-block"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            ownership
          </motion.span>
          <motion.span
            className="ml-2 inline-block h-[0.18em] w-[0.18em] translate-y-[-0.18em] bg-accent"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3, delay: 0.95 }}
          />
        </motion.h2>

        <motion.div
          className="mt-12 flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <ClosedStamp />
          <span className="text-ink/30">·</span>
          <span>skillloops.xyz</span>
        </motion.div>
      </div>
    ),
  },

  {
    eyebrow: "ROADMAP",
    caption: "What ships next",
    render: () => (
      <div className="flex min-h-full flex-col justify-center">
        <motion.div
          className="caption mb-5 flex items-center gap-3"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span>NEXT</span>
          <span className="text-ink/30">·</span>
          <span className="text-accent">ROADMAP</span>
        </motion.div>
        <motion.h2
          className="max-w-5xl font-display text-[clamp(3.4rem,8vw,7.2rem)] font-bold uppercase leading-[0.9] tracking-[-0.02em]"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.22, 0.61, 0.36, 1], delay: 0.08 }}
        >
          What <span className="text-accent">ships next</span>.
        </motion.h2>

        <motion.div
          className="mt-12 grid grid-cols-1 border border-ink bg-paper md:grid-cols-4"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
          }}
        >
          <RoadmapCell no="01" tag="NEXT" title="Judge DAO" sub="Stake & slash for fair scores" />
          <RoadmapCell no="02" tag="NEXT" title="Arbitration" sub="Appeal a disputed score" />
          <RoadmapCell no="03" tag="LATER" title="Tradeable shares" sub="Sell your stake on the open market" />
          <RoadmapCell no="04" tag="VISION" title="A2A network" sub="Agents improve skills on their own" last />
        </motion.div>
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
      } else if (/^[1-9]$/.test(event.key)) {
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

function ProblemCell({
  no,
  title,
  glyph,
  last = false,
}: {
  no: string;
  title: string;
  glyph?: ReactNode;
  last?: boolean;
}) {
  return (
    <motion.div
      className={cn("relative flex min-h-[180px] flex-col p-5", !last && "border-b border-ink md:border-b-0 md:border-r")}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
      }}
    >
      <div className="flex items-start justify-between">
        <div className="font-display text-5xl font-semibold leading-none text-accent">{no}</div>
        <div className="text-ink/70">{glyph}</div>
      </div>
      <h3 className="mt-auto font-display text-3xl font-semibold uppercase leading-none tracking-[0.04em]">{title}</h3>
    </motion.div>
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

/* ── cold-open slide ──────────────────────────────────────────────────── */

function ColdOpenSlide() {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden">
      {/* faint grid wash to keep the brand texture, behind the loop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(11,11,11,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(11,11,11,0.08) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* corner registration ticks */}
      <ColdOpenTicks />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 1.0, ease: [0.22, 0.61, 0.36, 1] }}
        className="relative"
      >
        {/* radial accent halo */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 blur-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.2 }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(255,91,31,0.18), rgba(255,91,31,0) 70%)",
          }}
        />
        <SkillLoopMotif size={420} active="REFLECT" spinTrigger={1} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 0.61, 0.36, 1], delay: 0.55 }}
        className="relative mt-10 text-center"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.42em] text-muted">
          Solana Hackathon · Demo
        </div>
        <h1 className="mt-3 font-display text-[clamp(3.4rem,8vw,7.6rem)] font-bold uppercase leading-[0.86] tracking-[-0.01em]">
          Skill Loops <span className="text-accent">Protocol</span>
          <motion.span
            className="ml-2 inline-block h-[0.18em] w-[0.18em] translate-y-[-0.18em] bg-accent"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1, 1, 0.6, 1] }}
            transition={{ duration: 1.4, delay: 1.0, times: [0, 0.3, 0.55, 0.75, 1] }}
          />
        </h1>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.1 }}
        className="relative mt-6 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.32em] text-muted"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
        </span>
        <span>SLP · v1.0</span>
        <span className="text-ink/30">·</span>
        <span>begin</span>
      </motion.div>
    </div>
  );
}

function ColdOpenTicks() {
  return (
    <>
      <div className="pointer-events-none absolute left-6 top-6 flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.3em] text-ink/40">
        <span className="h-2 w-2 border-l border-t border-ink/40" />
        <span>SLP-001</span>
      </div>
      <div className="pointer-events-none absolute right-6 top-6 flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.3em] text-ink/40">
        <span>DEVNET</span>
        <span className="h-2 w-2 border-r border-t border-ink/40" />
      </div>
      <div className="pointer-events-none absolute bottom-6 left-6 flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.3em] text-ink/40">
        <span className="h-2 w-2 border-b border-l border-ink/40" />
        <span>card 00</span>
      </div>
      <div className="pointer-events-none absolute bottom-6 right-6 flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.3em] text-ink/40">
        <span>↻ loop</span>
        <span className="h-2 w-2 border-b border-r border-ink/40" />
      </div>
    </>
  );
}

/* ── loop slide helpers ──────────────────────────────────────────────── */

function StageTag({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <motion.span
      variants={{
        hidden: { opacity: 0, y: 6 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.32 } },
      }}
      className={cn(
        "inline-flex items-center border border-ink px-3 py-2 font-display text-base font-semibold uppercase tracking-[0.08em]",
        accent ? "bg-accent text-ink" : "bg-paper text-ink"
      )}
    >
      {label}
    </motion.span>
  );
}

function StageArrow() {
  return (
    <motion.span
      aria-hidden
      variants={{
        hidden: { opacity: 0, x: -4 },
        visible: { opacity: 1, x: 0, transition: { duration: 0.32 } },
      }}
      className="inline-flex items-center text-ink/45"
    >
      <span className="block h-px w-6 bg-current" />
      <span className="-ml-[3px]">▸</span>
    </motion.span>
  );
}

/* ── roadmap slide helpers ───────────────────────────────────────────── */

function RoadmapCell({
  no,
  tag,
  title,
  sub,
  last = false,
}: {
  no: string;
  tag: string;
  title: string;
  sub?: string;
  last?: boolean;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
      }}
      className={cn(
        "relative flex min-h-[190px] flex-col p-5",
        !last && "border-b border-ink md:border-b-0 md:border-r"
      )}
    >
      <div className="flex items-baseline justify-between">
        <div className="font-display text-4xl font-semibold leading-none text-accent">{no}</div>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{tag}</span>
      </div>
      <div className="mt-auto">
        <h3 className="font-display text-xl font-semibold uppercase leading-tight tracking-[0.04em]">
          {title}
        </h3>
        {sub && (
          <p className="mt-2 font-mono text-[10px] uppercase leading-4 tracking-[0.12em] text-muted">
            {sub}
          </p>
        )}
      </div>
    </motion.div>
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
