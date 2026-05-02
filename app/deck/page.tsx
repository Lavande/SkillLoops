"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SkillLoopMotif } from "@/components/loop/SkillLoopMotif";
import { Chip } from "@/components/brutalist/Chip";
import { cn } from "@/lib/cn";

/* ─────────────── DECK ROOT ─────────────── */

export default function DeckPage() {
  const slides = SLIDES;
  const total = slides.length;
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);

  const go = useCallback(
    (n: number) => {
      setI((cur) => {
        const next = Math.max(0, Math.min(total - 1, n));
        setDir(next >= cur ? 1 : -1);
        return next;
      });
    },
    [total]
  );

  const next = useCallback(() => go(i + 1), [go, i]);
  const prev = useCallback(() => go(i - 1), [go, i]);

  // keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp" || e.key === "Backspace") {
        e.preventDefault();
        prev();
      } else if (e.key === "Home") {
        go(0);
      } else if (e.key === "End") {
        go(total - 1);
      } else if (/^[1-9]$/.test(e.key)) {
        go(Number(e.key) - 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, go, total]);

  // sync hash so slides are link-shareable
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.location.hash.match(/^#(\d+)$/);
    if (m) {
      const idx = Math.max(0, Math.min(total - 1, Number(m[1]) - 1));
      setI(idx);
    }
  }, [total]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    history.replaceState(null, "", `#${i + 1}`);
  }, [i]);

  const current = slides[i];

  return (
    <div className="h-screen w-screen overflow-hidden bg-paper text-ink relative bp-grid-dots flex flex-col">
      {/* ── top bar ── */}
      <div className="border-b border-ink bg-paper/90 backdrop-blur shrink-0">
        <div className="max-w-frame mx-auto px-6 py-3 flex items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-3">
            <DeckGlyph />
            <div className="font-display text-sm uppercase tracking-[0.14em]">
              Skill Loops <span className="text-accent">// Deck</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
            <span>SOLANA HACKATHON 2026</span>
            <span className="text-ink/30">·</span>
            <span>FILE / DEMO-001</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted hidden sm:inline">
              ← → space
            </span>
            <span className="plate font-mono text-[11px]">
              {String(i + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
          </div>
        </div>
        {/* progress rail */}
        <div className="h-[2px] w-full bg-ink/10">
          <div
            className="h-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${((i + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      {/* ── slide stage ── */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence custom={dir} mode="wait">
          <motion.div
            key={i}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -dir * 40 }}
            transition={{ duration: 0.35, ease: [0.22, 0.61, 0.36, 1] }}
            className="absolute inset-0"
          >
            <SlideShell index={i} total={total} eyebrow={current.eyebrow}>
              {current.render()}
            </SlideShell>
          </motion.div>
        </AnimatePresence>

        {/* edge click zones */}
        <button
          aria-label="Previous slide"
          onClick={prev}
          disabled={i === 0}
          className="absolute left-0 top-0 bottom-0 w-[12%] cursor-w-resize disabled:cursor-default group"
        >
          <span className="sr-only">Previous</span>
        </button>
        <button
          aria-label="Next slide"
          onClick={next}
          disabled={i === total - 1}
          className="absolute right-0 top-0 bottom-0 w-[12%] cursor-e-resize disabled:cursor-default group"
        >
          <span className="sr-only">Next</span>
        </button>
      </div>

      {/* ── bottom controls ── */}
      <div className="border-t border-ink bg-paper shrink-0">
        <div className="max-w-frame mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted hidden md:block truncate">
            {current.eyebrow}
          </div>
          {/* dot strip */}
          <div className="flex items-center gap-1.5 flex-1 justify-center max-w-[60%]">
            {slides.map((s, idx) => (
              <button
                key={idx}
                onClick={() => go(idx)}
                title={`${idx + 1}. ${s.eyebrow}`}
                aria-label={`Go to slide ${idx + 1}: ${s.eyebrow}`}
                className={cn(
                  "h-2 transition-all border border-ink",
                  idx === i ? "w-7 bg-accent" : idx < i ? "w-2 bg-ink" : "w-2 bg-paper"
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <NavBtn onClick={prev} disabled={i === 0} aria-label="Previous">←</NavBtn>
            <NavBtn onClick={next} disabled={i === total - 1} aria-label="Next">→</NavBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────── SHELL & PRIMITIVES ─────────────── */

function SlideShell({
  index,
  total,
  eyebrow,
  children,
}: {
  index: number;
  total: number;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="absolute inset-0 overflow-auto">
      <div className="max-w-frame mx-auto px-6 md:px-12 lg:px-16 py-10 md:py-14 min-h-full flex flex-col">
        <div className="flex items-baseline justify-between mb-6">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted">
              § {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-accent">
              {eyebrow}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted hidden md:inline">
            SLP DECK · v1.0
          </span>
        </div>
        <div className="flex-1 flex flex-col">{children}</div>
        {/* registration marks */}
        <CornerMarks />
      </div>
    </div>
  );
}

function CornerMarks() {
  return (
    <>
      <div className="pointer-events-none fixed top-[60px] left-3 w-3 h-3 border-l border-t border-ink/30" />
      <div className="pointer-events-none fixed top-[60px] right-3 w-3 h-3 border-r border-t border-ink/30" />
      <div className="pointer-events-none fixed bottom-[60px] left-3 w-3 h-3 border-l border-b border-ink/30" />
      <div className="pointer-events-none fixed bottom-[60px] right-3 w-3 h-3 border-r border-b border-ink/30" />
    </>
  );
}

function NavBtn({
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      className="w-9 h-9 inline-flex items-center justify-center border border-ink bg-paper hover:bg-ink hover:text-paper transition-colors disabled:opacity-30 disabled:cursor-not-allowed font-mono text-base"
    >
      {children}
    </button>
  );
}

function Headline({ children, kicker }: { children: ReactNode; kicker?: string }) {
  return (
    <div>
      {kicker ? (
        <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted mb-3">
          {kicker}
        </div>
      ) : null}
      <h2 className="font-display uppercase tracking-[-0.01em] leading-[0.95] text-[clamp(2.2rem,5.5vw,4.5rem)]">
        {children}
      </h2>
    </div>
  );
}

function Bullet({ children, mark = "→" }: { children: ReactNode; mark?: string }) {
  return (
    <li className="flex gap-3 items-baseline">
      <span className="text-accent font-mono shrink-0">{mark}</span>
      <span className="font-display uppercase tracking-[0.02em] leading-[1.2] text-[clamp(1rem,1.6vw,1.5rem)]">
        {children}
      </span>
    </li>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.2em] border border-ink px-2 py-[2px] bg-paper">
      {children}
    </span>
  );
}

/* ─────────────── INDIVIDUAL SLIDE CONTENT ─────────────── */

type Slide = { eyebrow: string; render: () => ReactNode };

const SLIDES: Slide[] = [
  /* 01 — TITLE */
  {
    eyebrow: "TITLE CARD",
    render: () => (
      <div className="flex-1 grid grid-cols-12 gap-8 items-center">
        <div className="col-span-12 md:col-span-7">
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted mb-4">
            Skill Loops Protocol — code &ldquo;SLP&rdquo;
          </div>
          <h1 className="font-display uppercase tracking-[-0.02em] leading-[0.9] text-[clamp(3rem,8vw,7rem)]">
            The skill that<br />
            <span className="text-accent">improves itself</span>.
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Tag>Solana · Devnet</Tag>
            <Tag>Anchor · 5 programs</Tag>
            <Tag>Built in 72 h</Tag>
          </div>
          <p className="font-mono text-[12px] uppercase tracking-[0.2em] text-muted mt-10">
            press → or space to advance
          </p>
        </div>
        <div className="col-span-12 md:col-span-5 flex justify-center md:justify-end">
          <SkillLoopMotif size={360} active="REFLECT" />
        </div>
      </div>
    ),
  },

  /* 02 — PROBLEM */
  {
    eyebrow: "PROBLEM",
    render: () => (
      <div className="flex-1 flex flex-col">
        <Headline kicker="Today, skill markets are broken in 3 ways.">
          Skills decay.<br />
          Failure is wasted.<br />
          Buyers don&apos;t care.
        </Headline>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          {[
            { n: "01", t: "DECAY", b: "month-1 skill ≈ half-broken by month 6" },
            { n: "02", t: "WASTED SIGNAL", b: "agent failures never reach the author" },
            { n: "03", t: "ZERO-SUM", b: "buyer has no stake after the sale" },
          ].map((c) => (
            <div key={c.n} className="border border-ink bg-paper p-5 flex flex-col">
              <span className="font-display text-4xl text-accent leading-none">{c.n}</span>
              <span className="font-display uppercase tracking-[0.06em] text-lg mt-4">{c.t}</span>
              <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink/70 mt-2 leading-[1.5]">
                {c.b}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  /* 03 — ONE LINE */
  {
    eyebrow: "ONE-LINER",
    render: () => (
      <div className="flex-1 flex items-center">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted mb-6">
            What we are building, in one breath.
          </div>
          <p className="font-display uppercase leading-[1] tracking-[-0.01em] text-[clamp(2rem,6vw,5rem)] max-w-[18ch]">
            Buying a skill is <span className="text-accent">opting into ownership</span> at zero shares.
          </p>
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl">
            {[
              "buy ↦ joined the cap table",
              "contribute ↦ shares minted",
              "skill earns ↦ holders earn",
            ].map((s) => (
              <div key={s} className="border border-ink bg-paper-raised p-4 font-mono text-[12px] uppercase tracking-[0.12em]">
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },

  /* 04 — INSIGHT */
  {
    eyebrow: "INSIGHT",
    render: () => (
      <div className="flex-1 flex items-center">
        <div className="grid grid-cols-12 gap-8 items-center w-full">
          <div className="col-span-12 md:col-span-7">
            <Headline kicker="The single move that re-wires every incentive.">
              Mint shares.<br />
              <span className="text-accent">Don&apos;t transfer them.</span>
            </Headline>
            <ul className="mt-8 space-y-4">
              <Bullet>buyers start at 0 shares</Bullet>
              <Bullet>contributions mint new shares</Bullet>
              <Bullet>author floor is protected by contract</Bullet>
              <Bullet>shareholders share future revenue</Bullet>
            </ul>
          </div>
          <div className="col-span-12 md:col-span-5">
            <div className="border border-ink bg-paper-raised p-5 space-y-5">
              <ShareBar label="t = 0" segments={[{ name: "ALICE", pct: 100, tone: "ink" }]} />
              <ShareBar
                label="after Bob contributes (38/50)"
                segments={[
                  { name: "ALICE", pct: 72.5, tone: "ink" },
                  { name: "BOB", pct: 27.5, tone: "accent" },
                ]}
              />
              <ShareBar
                label="after Carol just subscribes"
                segments={[
                  { name: "ALICE", pct: 72.5, tone: "ink" },
                  { name: "BOB", pct: 27.5, tone: "accent" },
                  { name: "CAROL", pct: 0, tone: "muted" },
                ]}
              />
            </div>
          </div>
        </div>
      </div>
    ),
  },

  /* 05 — THE LOOP */
  {
    eyebrow: "THE LOOP",
    render: () => (
      <div className="flex-1 grid grid-cols-12 gap-8 items-center">
        <div className="col-span-12 md:col-span-5 flex justify-center">
          <SkillLoopMotif size={420} active="JUDGE" />
        </div>
        <div className="col-span-12 md:col-span-7">
          <Headline kicker="One loop. Five stages. Forever.">
            Use → Reflect →<br />
            Submit → Judge →<br />
            <span className="text-accent">Evolve</span>.
          </Headline>
          <div className="mt-8 grid grid-cols-2 gap-3 max-w-xl">
            {[
              ["01 USE", "agent runs target skill"],
              ["02 REFLECT", "drafts patch + JSON"],
              ["03 SUBMIT", "Phantom signs · on-chain"],
              ["04 JUDGE", "AI scores 5 dims · 30s"],
              ["05 EVOLVE", "shares minted · v+1"],
            ].map(([k, v]) => (
              <div key={k} className="border border-ink bg-paper px-3 py-2">
                <div className="font-display text-sm uppercase tracking-[0.06em] text-accent">{k}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink/80 mt-1">
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },

  /* 06 — CANONICAL */
  {
    eyebrow: "CANONICAL EXAMPLE",
    render: () => (
      <div className="flex-1 flex flex-col">
        <Headline kicker="The story we&rsquo;ll demo on stage.">
          The PR Review skill<br />
          and a <span className="text-accent">Rust unsafe</span> block.
        </Headline>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-3 flex-1">
          {[
            { who: "ALICE", role: "AUTHOR", act: "publishes skill · 0.1 SOL/mo" },
            { who: "BOB", role: "OPERATOR", act: "subscribes · agent fails · reflects" },
            { who: "JUDGE", role: "AI · CLAUDE", act: "scores 38/50 · signs report" },
            { who: "CAROL", role: "SUBSCRIBER", act: "pays · earns 0 shares" },
          ].map((c) => (
            <div key={c.who} className="border border-ink bg-paper p-4 flex flex-col justify-between">
              <div>
                <div className="font-display uppercase tracking-[0.08em] text-xl">{c.who}</div>
                <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent mt-1">
                  {c.role}
                </div>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink/75 mt-6 leading-[1.5]">
                {c.act}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  /* 07 — ARCHITECTURE */
  {
    eyebrow: "ARCHITECTURE",
    render: () => (
      <div className="flex-1 flex flex-col">
        <Headline kicker="Everything that has to be true for the loop to close.">
          One <span className="text-accent">skill-shaped</span> client.<br />
          Five Anchor programs.
        </Headline>
        <div className="mt-8 grid grid-cols-12 gap-4 flex-1">
          <div className="col-span-12 md:col-span-7 border border-ink bg-paper p-4 overflow-auto">
            <pre className="font-mono text-[11px] leading-[1.55] whitespace-pre">
{`AGENT HOST  (Claude Desktop · Cursor · any host)
  ├─ target skill         (decrypted after subscribe)
  └─ reflection skill     (free · public · the client)
        │
        │   paste JSON
        ▼
WEB APP  (skillloops.xyz)
  ├─ Phantom → Irys upload   (free <100KB)
  └─ Phantom → Solana submit
        │
        ├─→ AI JUDGE          (Claude · score · sign)
        ├─→ 5 ANCHOR PROGRAMS (Registry · Sub · Shares
        │                      · Experience · Pool)
        └─→ STORAGE           (Irys → Arweave · permanent)
                  │
                  └─→ LIT  (subscriber-gated keys)`}
            </pre>
          </div>
          <ul className="col-span-12 md:col-span-5 space-y-3">
            {[
              "client = a SKILL.md, not an SDK",
              "storage = Irys → Arweave, free under 100 KB",
              "signing = always in the browser, via Phantom",
            ].map((b) => (
              <li
                key={b}
                className="border border-ink bg-paper-raised p-4 font-display uppercase tracking-[0.04em] text-base leading-[1.25]"
              >
                <span className="text-accent mr-2">★</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>
    ),
  },

  /* 08 — STACK */
  {
    eyebrow: "STACK",
    render: () => (
      <div className="flex-1 flex flex-col">
        <Headline kicker="Choices we picked on purpose.">The stack.</Headline>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-0 border border-ink flex-1">
          {[
            ["CONTRACTS", "Anchor · Rust"],
            ["STORAGE", "Irys → Arweave"],
            ["GATING", "Lit Protocol"],
            ["JUDGE", "claude-opus-4-7"],
            ["AGENT CLIENT", "Reflection SKILL.md"],
            ["FRONTEND", "Next.js 14 · Tailwind"],
          ].map(([k, v], idx) => (
            <div
              key={k}
              className={cn(
                "p-5 flex flex-col justify-between bg-paper",
                idx % 2 === 1 && "bg-paper-raised",
                idx % 3 !== 2 && "md:border-r border-ink",
                idx < 3 && "border-b border-ink"
              )}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">{k}</div>
              <div className="font-display text-2xl uppercase tracking-[0.02em] mt-2">{v}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  /* 09 — DEMO BEATS */
  {
    eyebrow: "ON-STAGE · 3 MIN",
    render: () => (
      <div className="flex-1 flex flex-col">
        <Headline kicker="The whole loop, live, in three minutes.">
          Six beats.<br />
          <span className="text-accent">No recording.</span>
        </Headline>
        <ol className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 content-start">
          {[
            ["1", "PUBLISH", "Alice signs Irys + Solana"],
            ["2", "SUBSCRIBE", "Bob joins · ShareAccount = 0"],
            ["3", "USE & FAIL", "agent misses unsafe block"],
            ["4", "REFLECT", "skill outputs ExperienceBundle"],
            ["5", "SUBMIT & JUDGE", "score 38/50 · 380 shares"],
            ["6", "SETTLE & EVOLVE", "Alice merges · v1.1"],
          ].map(([n, t, b]) => (
            <li key={n} className="border border-ink bg-paper p-4 flex gap-4 items-start">
              <span className="font-display text-3xl text-accent leading-none shrink-0 w-8">{n}</span>
              <div>
                <div className="font-display uppercase tracking-[0.06em] text-base">{t}</div>
                <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink/75 mt-1">
                  {b}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    ),
  },

  /* 10 — NUMBERS */
  {
    eyebrow: "WHAT WE SHIPPED",
    render: () => (
      <div className="flex-1 flex flex-col">
        <Headline kicker="72 hours. 3 builders. 1 weekend.">
          Every number is <span className="text-accent">real</span>.
        </Headline>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-0 border border-ink flex-1">
          {[
            ["5/5", "ANCHOR PROGRAMS"],
            ["≈30s", "JUDGE LATENCY"],
            ["$0", "STORAGE COST"],
            ["3", "LIVE WALLETS"],
            ["1", "REFLECTION SKILL"],
            ["7", "ON-CHAIN ACCT TYPES"],
            ["30%", "AUTHOR FLOOR (MIN)"],
            ["300s", "DEMO PERIOD"],
          ].map(([v, k], idx) => (
            <div
              key={k}
              className={cn(
                "p-5 flex flex-col justify-between bg-paper",
                idx % 2 === 1 && "bg-paper-raised",
                idx % 4 !== 3 && "md:border-r border-ink",
                idx < 4 && "border-b border-ink"
              )}
            >
              <div className="font-display text-display-2 leading-[1] text-ink">
                {v}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mt-3">
                {k}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  /* 11 — KNOWN LIMITS */
  {
    eyebrow: "OPEN TRADE-OFFS",
    render: () => (
      <div className="flex-1 flex flex-col">
        <Headline kicker="What we&rsquo;re honest about.">
          Three explicit trade-offs.<br />
          <span className="text-accent">Each has an upgrade path.</span>
        </Headline>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
          {[
            { now: "1 Judge · 1 key", next: "Judge DAO · stake · slash" },
            { now: "Periodic snapshot", next: "Merkle distribution" },
            { now: "Plaintext storage", next: "ZK privacy" },
          ].map((t) => (
            <div key={t.now} className="border border-ink bg-paper p-5 flex flex-col">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">TODAY</div>
              <div className="font-display uppercase tracking-[0.04em] text-xl mt-1">{t.now}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted mt-6">
                ROADMAP
              </div>
              <div className="font-display uppercase tracking-[0.04em] text-xl mt-1 text-accent">
                {t.next}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  /* 12 — ROADMAP */
  {
    eyebrow: "ROADMAP",
    render: () => (
      <div className="flex-1 flex flex-col">
        <Headline kicker="Where the protocol goes after this weekend.">
          Four horizons.
        </Headline>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-0 border border-ink flex-1">
          {[
            { id: "01", t: "DECENTRALIZE TRUST", p: "P0", items: ["multi-judge stake/slash", "Judge DAO + token", "regression engine"] },
            { id: "02", t: "DEEPEN ECONOMY", p: "P1", items: ["Kleros arbitration", "secondary share market", "agent-to-agent layer"] },
            { id: "03", t: "HARDEN & SCALE", p: "P2", items: ["zkVM proofs", "1-click merge", "Merkle revenue"] },
            { id: "04", t: "EXPAND ECOSYSTEM", p: "P3", items: ["fork mechanism", "skill-as-IP NFTs", "cross-chain market"] },
          ].map((p, idx) => (
            <div
              key={p.id}
              className={cn(
                "p-5 bg-paper flex flex-col",
                idx % 2 === 1 && "bg-paper-raised",
                idx < 3 && "md:border-r border-ink",
                idx < 3 && "border-b md:border-b-0 border-ink"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl text-accent leading-none">{p.id}</span>
                <Chip tone={p.p === "P0" ? "accent" : p.p === "P1" ? "ink" : "ghost"}>{p.p}</Chip>
              </div>
              <div className="font-display uppercase tracking-[0.04em] text-base mt-4 leading-tight">
                {p.t}
              </div>
              <ul className="mt-3 space-y-1.5 font-mono text-[11px] text-ink/85">
                {p.items.map((it) => (
                  <li key={it} className="flex gap-2 leading-[1.4]">
                    <span className="text-accent shrink-0">→</span>
                    <span className="uppercase tracking-[0.06em]">{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    ),
  },

  /* 13 — WHY IT MATTERS */
  {
    eyebrow: "WHY IT MATTERS",
    render: () => (
      <div className="flex-1 flex flex-col justify-center">
        <Headline kicker="Four lines we&rsquo;ll keep repeating.">
          Why this <span className="text-accent">matters</span>.
        </Headline>
        <ol className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            "Every buyer is a potential shareholder.",
            "Skills get better the more they fail.",
            "AI skills · AI agents · AI judges.",
            "The first skill teaches the others to evolve.",
          ].map((line, i) => (
            <li
              key={line}
              className="border border-ink bg-paper p-5 flex gap-4 items-start"
            >
              <span className="font-display text-4xl text-accent leading-none shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display uppercase tracking-[0.02em] leading-[1.15] text-[clamp(1.1rem,1.8vw,1.6rem)]">
                {line}
              </span>
            </li>
          ))}
        </ol>
      </div>
    ),
  },

  /* 14 — END / THANKS */
  {
    eyebrow: "END OF DECK",
    render: () => (
      <div className="flex-1 flex items-center">
        <div className="w-full grid grid-cols-12 gap-8 items-center">
          <div className="col-span-12 md:col-span-7">
            <h2 className="font-display uppercase tracking-[-0.02em] leading-[0.92] text-[clamp(3rem,8vw,6.5rem)]">
              Thank you.<br />
              <span className="text-accent">Questions?</span>
            </h2>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-xl">
              {[
                ["SITE", "skillloops.xyz"],
                ["LIVE", "/console"],
                ["DECK", "/deck"],
              ].map(([k, v]) => (
                <div key={k} className="border border-ink bg-paper-raised p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{k}</div>
                  <div className="font-display text-base uppercase tracking-[0.04em] mt-1">{v}</div>
                </div>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/console"
                className="inline-flex items-center gap-2 px-4 py-2 uppercase tracking-[0.18em] text-[11px] font-mono bg-accent text-ink border border-ink hover:bg-ink hover:text-paper transition-colors"
              >
                Open live console →
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-4 py-2 uppercase tracking-[0.18em] text-[11px] font-mono bg-paper text-ink border border-ink hover:bg-ink hover:text-paper transition-colors"
              >
                Back to spec
              </Link>
            </div>
          </div>
          <div className="col-span-12 md:col-span-5 flex justify-center md:justify-end">
            <SkillLoopMotif size={340} active="EVOLVE" />
          </div>
        </div>
      </div>
    ),
  },
];

/* ─────────────── share bar (used on insight slide) ─────────────── */

function ShareBar({
  label,
  segments,
}: {
  label: string;
  segments: { name: string; pct: number; tone: "ink" | "accent" | "muted" }[];
}) {
  const visible = useMemo(() => segments.filter((s) => s.pct > 0), [segments]);
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">{label}</div>
      <div className="flex w-full h-7 border border-ink bg-paper mt-2">
        {visible.map((s, i) => (
          <div
            key={s.name + i}
            style={{ width: `${s.pct}%` }}
            className={cn(
              "h-full flex items-center justify-center font-mono text-[10px] uppercase tracking-[0.14em]",
              s.tone === "accent" && "bg-accent text-ink",
              s.tone === "ink" && "bg-ink text-paper",
              s.tone === "muted" && "bg-paper-raised text-ink/70",
              i > 0 && "border-l border-ink"
            )}
          >
            {s.pct >= 12 ? `${s.name} · ${s.pct}%` : `${s.pct}%`}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/70">
        {segments.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1">
            <span
              className={cn(
                "inline-block w-2 h-2 border border-ink",
                s.tone === "accent" && "bg-accent",
                s.tone === "ink" && "bg-ink",
                s.tone === "muted" && "bg-paper-raised"
              )}
            />
            {s.name} · {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

function DeckGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <rect x="2" y="2" width="18" height="18" stroke="currentColor" fill="none" />
      <rect x="5" y="5" width="12" height="12" stroke="currentColor" fill="none" strokeDasharray="2 2" />
      <circle cx="11" cy="11" r="2" fill="#FF5B1F" />
    </svg>
  );
}
