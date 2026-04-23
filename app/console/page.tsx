"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";
import { Chip } from "@/components/brutalist/Chip";
import { MonoId } from "@/components/brutalist/MonoId";
import { SkillLoopMotif } from "@/components/loop/SkillLoopMotif";
import { StackedShareBar } from "@/components/charts/StackedShareBar";
import { DEMO_PERSONAS } from "./personas";

interface StepDef {
  id: string;
  act: number;
  actLabel: string;
  title: string;
  description: string;
  action?: string;
  persona?: keyof typeof DEMO_PERSONAS;
  activeStage?: "USE" | "REFLECT" | "SUBMIT" | "JUDGE" | "EVOLVE";
  focus?: "market" | "skill" | "me" | "submit" | "landing" | "reflection";
}

const STEPS: StepDef[] = [
  { id: "00", act: 0, actLabel: "SETUP", title: "Reset + seed demo state", description: "Clears the mock DB and seeds Alice's 'GitHub PR Review' skill plus a market of 6 others. Idempotent.", action: "reset_then_seed", focus: "landing" },
  { id: "01", act: 1, actLabel: "PUBLISH", title: "Alice is already on the market (seeded at setup)", description: "Show Alice's skill on /skill/[id]: 1000/1000 shares, author-only cap table, revenue pool 0.", focus: "skill" },
  { id: "02", act: 2, actLabel: "SUBSCRIBE", title: "Bob subscribes to Alice's skill (0.1 SOL)", description: "Phantom popup appears (impersonated). A ShareAccount is created for Bob at 0 shares — he's on the cap table now.", action: "subscribe_bob", persona: "bob", focus: "skill", activeStage: "USE" },
  { id: "03", act: 3, actLabel: "USE & REFLECT", title: "Bob's agent uses the skill and fails on a Rust PR", description: "We skip to the produced ExperienceBundle. Note the 38/50 demo trace id — the Judge will score it as such.", activeStage: "REFLECT", focus: "skill" },
  { id: "04", act: 4, actLabel: "SUBMIT", title: "Bob submits the ExperienceBundle", description: "Creates a Pending ExperienceRecord on Alice's skill. Bundle uploaded to Arweave via Irys.", action: "submit_bob_experience", persona: "bob", focus: "skill", activeStage: "SUBMIT" },
  { id: "05", act: 4, actLabel: "JUDGE", title: "AI Judge evaluates → 38/50 APPROVE", description: "Deterministic mock judge returns exactly 38/50 for this trace. Contract mints 380 shares for Bob. Alice 72.5% / Bob 27.5%.", action: "evaluate", focus: "skill", activeStage: "JUDGE" },
  { id: "06", act: 5, actLabel: "SUBSCRIBE 2", title: "Carol subscribes", description: "Carol pays 0.1 SOL. She's a 0-share shareholder: on the cap table but with no equity. When revenue settles she gets nothing.", action: "subscribe_carol", persona: "carol", focus: "skill" },
  { id: "07", act: 5, actLabel: "SETTLE", title: "Settle the period", description: "For the demo we rewind the current_period_start so settle succeeds instantly. The pool snapshots; claimable_revenue entries are created.", action: "force_settle_then_settle", focus: "skill" },
  { id: "08", act: 5, actLabel: "CLAIM — ALICE", title: "Alice claims her 72.5%", description: "Phantom popup (impersonated as Alice). Lamports move into Alice's mock balance.", action: "claim_alice", persona: "alice", focus: "me" },
  { id: "09", act: 5, actLabel: "CLAIM — BOB", title: "Bob claims his 27.5%", description: "Same beat for Bob. Carol stays at 0.", action: "claim_bob", persona: "bob", focus: "me" },
  { id: "10", act: 6, actLabel: "EVOLVE", title: "Alice publishes v1.1 with Bob's patch", description: "The Skill Loop motif completes one full rotation. Bob is permanently recorded as a contributor to v1.1.", action: "publish_v1_1", persona: "alice", focus: "skill", activeStage: "EVOLVE" },
];

export default function ConsolePage() {
  const [cursor, setCursor] = useState(0);
  const [log, setLog] = useState<{ ts: number; text: string; kind: "ok" | "err" | "info" }[]>([]);
  const [running, setRunning] = useState(false);
  const [aliceSkillId, setAliceSkillId] = useState<string | null>(null);
  const [shares, setShares] = useState<any | null>(null);
  const [loopTrigger, setLoopTrigger] = useState(0);
  const prevShares = useRef<number | null>(null);
  const step = STEPS[cursor];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, running, aliceSkillId]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (!aliceSkillId) return;
      try {
        const s = await api.skill(aliceSkillId, null);
        if (cancelled) return;
        setShares(s);
        if (prevShares.current != null && s.ledger.totalShares > prevShares.current) {
          setLoopTrigger((n) => n + 1);
        }
        prevShares.current = s.ledger.totalShares;
      } catch {}
    }
    refresh();
    const t = setInterval(refresh, 1500);
    return () => { cancelled = true; clearInterval(t); };
  }, [aliceSkillId]);

  function pushLog(text: string, kind: "ok" | "err" | "info" = "info") {
    setLog((l) => [...l.slice(-20), { ts: Date.now(), text, kind }]);
  }

  async function advance() {
    if (running) return;
    const s = STEPS[cursor];
    if (!s) return;
    setRunning(true);
    try {
      pushLog(`→ ${s.id} ${s.title}`, "info");
      if (s.action) {
        const result = await runAction(s.action, s.persona);
        if (result?.skillId) setAliceSkillId(result.skillId);
        if (result?.aliceSkillId) setAliceSkillId(result.aliceSkillId);
        pushLog(`  ok: ${JSON.stringify(result).slice(0, 220)}`, "ok");
      } else {
        pushLog("  (narration)", "info");
      }
      setCursor((c) => Math.min(STEPS.length - 1, c + 1));
    } catch (e: any) {
      pushLog(`  err: ${e?.message ?? e}`, "err");
    } finally {
      setRunning(false);
    }
  }

  async function reset() {
    setRunning(true);
    try {
      await api.consoleStep("reset");
      setCursor(0);
      setLog([{ ts: Date.now(), text: "reset", kind: "info" }]);
      setAliceSkillId(null);
      setShares(null);
      prevShares.current = null;
    } finally {
      setRunning(false);
    }
  }

  async function runAction(action: string, persona?: keyof typeof DEMO_PERSONAS) {
    if (action === "reset_then_seed") {
      await api.consoleStep("reset");
      const seed = await api.consoleStep("seed");
      if (seed?.aliceSkillId) setAliceSkillId(seed.aliceSkillId);
      return seed;
    }
    if (action === "force_settle_then_settle") {
      await api.consoleStep("force_settle_ready");
      return api.consoleStep("settle");
    }
    const impersonate = persona ? DEMO_PERSONAS[persona] : undefined;
    return api.consoleStep(action, impersonate);
  }

  const progress = ((cursor + 1) / STEPS.length) * 100;

  return (
    <div className="grid grid-cols-12 gap-6 pt-6">
      <header className="col-span-12 flex items-end justify-between">
        <div>
          <div className="caption">DEMO / CONSOLE</div>
          <h1 className="font-display text-display-2 uppercase">Step-through controller</h1>
          <p className="font-mono text-xs text-muted mt-2">
            ← back · → advance · runs the full PRD demo script against the mock backend. Personas are impersonated, so no wallet swap needed.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Chip tone="muted">act {step.act}</Chip>
          <Chip tone="ink">{step.actLabel}</Chip>
          <Btn variant="ghost" onClick={reset}>Reset</Btn>
        </div>
      </header>

      <div className="col-span-12 relative h-[4px] border border-ink bg-paper-raised">
        <div className="absolute top-0 left-0 bottom-0 bg-accent" style={{ width: `${progress}%`, transition: "width 400ms ease" }} />
      </div>

      {/* Stepper */}
      <LabeledBox title="STEPS" code={`${cursor + 1}/${STEPS.length}`} className="col-span-12 lg:col-span-4">
        <ol className="flex flex-col">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                onClick={() => setCursor(i)}
                className={`w-full text-left flex items-start gap-3 px-2 py-2 border-b border-ink/15 ${i === cursor ? "bg-accent/10" : "hover:bg-paper-raised"}`}
              >
                <span className="font-mono text-[10px] text-muted mt-1">{s.id}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display uppercase text-sm">{s.actLabel}</span>
                    {s.persona ? <Chip tone="muted">as {s.persona}</Chip> : null}
                  </div>
                  <div className="font-mono text-[11px] text-ink/85">{s.title}</div>
                </div>
              </button>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex items-center gap-2">
          <Btn variant="ink" onClick={() => setCursor((c) => Math.max(0, c - 1))} disabled={cursor === 0 || running}>← Back</Btn>
          <Btn variant="primary" onClick={advance} disabled={running}>
            {running ? "running…" : step.action ? "Run step →" : "Next →"}
          </Btn>
        </div>
      </LabeledBox>

      {/* Viewport */}
      <section className="col-span-12 lg:col-span-8 flex flex-col gap-4">
        <LabeledBox title="VIEWPORT" code={step.focus ?? "—"}>
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="font-display text-xl uppercase">{step.title}</div>
                <p className="font-serif text-base mt-1 max-w-2xl leading-[1.35]">{step.description}</p>
                {aliceSkillId && step.focus === "skill" ? (
                  <Link href={`/skill/${aliceSkillId}`} target="_blank" className="accent-underline font-mono text-[11px] uppercase tracking-[0.2em] mt-2 inline-block">
                    open /skill/{aliceSkillId.slice(0, 10)}… in a new tab →
                  </Link>
                ) : null}
                {step.focus === "me" ? (
                  <Link href="/me" target="_blank" className="accent-underline font-mono text-[11px] uppercase tracking-[0.2em] mt-2 inline-block">
                    open /me in a new tab →
                  </Link>
                ) : null}
              </div>
              <SkillLoopMotif size={180} active={step.activeStage ?? null} spinTrigger={loopTrigger} dense />
            </div>

            {shares ? (
              <div>
                <div className="caption mb-2">LIVE CAP TABLE · ALICE'S SKILL</div>
                <StackedShareBar
                  slices={shares.holders.map((h: any) => ({ holder: h.holder, shares: h.shares, isAuthor: h.isAuthor }))}
                  totalShares={shares.ledger.totalShares}
                  minAuthorRatioBps={shares.ledger.minAuthorRatioBps}
                  annotate={false}
                />
                <div className="mt-3 grid grid-cols-4 gap-3 font-mono text-[11px]">
                  {shares.holders.slice(0, 4).map((h: any) => (
                    <div key={h.holder} className="flex items-center gap-2 min-w-0">
                      <MonoId value={h.holder} />
                      <span className="ml-auto">{h.shares}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </LabeledBox>

        <LabeledBox title="LOG" code="§ stdout">
          <pre className="font-mono text-[10px] leading-5 max-h-[220px] overflow-auto">
{log.slice().reverse().map((l) => `${new Date(l.ts).toLocaleTimeString()}  ${l.kind.toUpperCase().padEnd(4)}  ${l.text}`).join("\n") || "(empty)"}
          </pre>
        </LabeledBox>
      </section>
    </div>
  );
}
