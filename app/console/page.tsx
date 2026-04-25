"use client";

import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { api } from "@/lib/api-client";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";
import { Chip } from "@/components/brutalist/Chip";
import { MonoId } from "@/components/brutalist/MonoId";
import { SkillLoopMotif } from "@/components/loop/SkillLoopMotif";
import { StackedShareBar } from "@/components/charts/StackedShareBar";
import { TxStatus } from "@/components/brutalist/TxStatus";
import { fetchPersonaPubkeys, unlockPersonaSigners, type PersonaName, type PersonaPubkeys, type PersonaSigners } from "./personas";
import { getConnection } from "@/lib/chain/connection";
import { getChainConfig } from "@/lib/chain/config";
import {
  subscribe as chainSubscribe,
  submitExperience as chainSubmit,
  settlePeriod as chainSettle,
  claimRevenue as chainClaim,
  publishNewVersion as chainPublishVersion,
  getNextExperienceId,
} from "@/lib/chain/tx";
import { getProgram } from "@/lib/chain/program";
import { pdas } from "@/lib/chain/pdas";

interface StepDef {
  id: string;
  act: number;
  actLabel: string;
  title: string;
  description: string;
  action?: string;
  persona?: PersonaName;
  activeStage?: "USE" | "REFLECT" | "SUBMIT" | "JUDGE" | "EVOLVE";
  focus?: "market" | "skill" | "me" | "submit" | "landing" | "reflection";
}

const STEPS: StepDef[] = [
  { id: "00", act: 0, actLabel: "SETUP", title: "Reset + seed demo state", description: "Clears the SQLite indexer DB. Skills are seeded on chain ahead of time via `pnpm tsx scripts/seed-devnet.ts`; the indexer projects them into SQLite as it catches up.", action: "reset_then_seed", focus: "landing" },
  { id: "01", act: 1, actLabel: "PUBLISH", title: "Alice is already on the market (seeded at setup)", description: "Show Alice's skill on /skill/[id]: 1000/1000 shares, author-only cap table, revenue pool 0.", focus: "skill" },
  { id: "02", act: 2, actLabel: "SUBSCRIBE", title: "Bob subscribes to Alice's skill (0.1 SOL)", description: "Persona-signed devnet tx. A ShareAccount is created for Bob at 0 shares — he's on the cap table now.", action: "subscribe_bob", persona: "bob", focus: "skill", activeStage: "USE" },
  { id: "03", act: 3, actLabel: "USE & REFLECT", title: "Bob's agent uses the skill and fails on a Rust PR", description: "We skip to the produced ExperienceBundle. Note the 38/50 demo trace id — the Judge will score it as such.", activeStage: "REFLECT", focus: "skill" },
  { id: "04", act: 4, actLabel: "SUBMIT", title: "Bob submits the ExperienceBundle", description: "Creates a Pending ExperienceRecord on Alice's skill. Bundle uploaded to Arweave via Irys then submitted on chain.", action: "submit_bob_experience", persona: "bob", focus: "skill", activeStage: "SUBMIT" },
  { id: "05", act: 4, actLabel: "JUDGE", title: "AI Judge evaluates → 38/50 APPROVE", description: "Deterministic mock judge returns exactly 38/50 for this trace. Contract mints 380 shares for Bob. Alice 72.5% / Bob 27.5%.", action: "evaluate", focus: "skill", activeStage: "JUDGE" },
  { id: "06", act: 5, actLabel: "SUBSCRIBE 2", title: "Carol subscribes", description: "Carol pays 0.1 SOL. She's a 0-share shareholder: on the cap table but with no equity. When revenue settles she gets nothing.", action: "subscribe_carol", persona: "carol", focus: "skill" },
  { id: "07", act: 5, actLabel: "SETTLE", title: "Settle the period", description: "Alice's skill uses a 60-second period at seed time so settle works without rewinding the devnet clock. We poll until period_end and call settle.", action: "wait_then_settle", persona: "alice", focus: "skill" },
  { id: "08", act: 5, actLabel: "CLAIM — ALICE", title: "Alice claims her 72.5%", description: "Persona-signed tx. Lamports move into Alice's devnet balance.", action: "claim_alice", persona: "alice", focus: "me" },
  { id: "09", act: 5, actLabel: "CLAIM — BOB", title: "Bob claims his 27.5%", description: "Same beat for Bob. Carol stays at 0.", action: "claim_bob", persona: "bob", focus: "me" },
  { id: "10", act: 6, actLabel: "EVOLVE", title: "Alice publishes v1.1 with Bob's patch", description: "The Skill Loop motif completes one full rotation. Bob is permanently recorded as a contributor to v1.1.", action: "publish_v1_1", persona: "alice", focus: "skill", activeStage: "EVOLVE" },
];

const DEMO_BUNDLE = {
  trace_id: "trace-demo-bob-rust-pr-001",
  outcome: "fail" as const,
  steps_taken: 7,
  artifacts_produced: ["review.md"],
  reflection: {
    what_worked: ["Caught missing tests", "Detected style drift"],
    what_failed: ["Missed unsafe block in error path", "Didn't flag clone() loop"],
    proposed_patch: "Add explicit checks for `unsafe` blocks and O(n) clone() patterns inside loops.",
  },
};

type TxState = "idle" | "signing" | "confirming" | "confirmed" | "error";

async function sha256Bytes(content: string): Promise<Uint8Array> {
  const buf = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(digest);
}

export default function ConsolePage() {
  const [cursor, setCursor] = useState(0);
  const [log, setLog] = useState<{ ts: number; text: string; kind: "ok" | "err" | "info" }[]>([]);
  const [running, setRunning] = useState(false);
  const [aliceSkillId, setAliceSkillId] = useState<string | null>(null);
  const [bobExperienceId, setBobExperienceId] = useState<bigint | null>(null);
  const [shares, setShares] = useState<any | null>(null);
  const [skillData, setSkillData] = useState<any | null>(null);
  const [loopTrigger, setLoopTrigger] = useState(0);
  const [pubkeys, setPubkeys] = useState<PersonaPubkeys | null>(null);
  const [signers, setSigners] = useState<PersonaSigners | null>(null);
  const [personasError, setPersonasError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<TxState>("idle");
  const [txSig, setTxSig] = useState<string | undefined>();
  const prevShares = useRef<number | null>(null);
  const step = STEPS[cursor];
  const { cluster, programId } = getChainConfig();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pks = await fetchPersonaPubkeys();
        if (cancelled) return;
        setPubkeys(pks);
        const s = await unlockPersonaSigners();
        if (cancelled) return;
        setSigners(s);
      } catch (e: any) {
        if (cancelled) return;
        setPersonasError(e?.message ?? "personas_unavailable");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshSkill = useCallback(async () => {
    if (!aliceSkillId) return;
    try {
      const s = await api.skill(aliceSkillId, null);
      setShares(s);
      setSkillData(s);
      if (prevShares.current != null && s.ledger.totalShares > prevShares.current) {
        setLoopTrigger((n) => n + 1);
      }
      prevShares.current = s.ledger.totalShares;
    } catch {}
  }, [aliceSkillId]);

  useEffect(() => {
    refreshSkill();
    const t = setInterval(refreshSkill, 1500);
    return () => clearInterval(t);
  }, [refreshSkill]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor, running, aliceSkillId, signers, bobExperienceId]);

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
        pushLog(`  ok: ${JSON.stringify(result, jsonReplacer).slice(0, 220)}`, "ok");
      } else {
        pushLog("  (narration)", "info");
      }
      setCursor((c) => Math.min(STEPS.length - 1, c + 1));
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      pushLog(`  err: ${msg}`, "err");
      setTxStatus("error");
    } finally {
      setRunning(false);
    }
  }

  async function reset() {
    setRunning(true);
    try {
      await fetch("/api/reset", { method: "POST" });
      setCursor(0);
      setLog([{ ts: Date.now(), text: "reset", kind: "info" }]);
      setAliceSkillId(null);
      setBobExperienceId(null);
      setShares(null);
      setSkillData(null);
      setTxStatus("idle");
      setTxSig(undefined);
      prevShares.current = null;
    } finally {
      setRunning(false);
    }
  }

  function requireSigner(persona?: PersonaName) {
    if (!signers) throw new Error("personas not unlocked — set DEMO_MODE=true and run pnpm tsx scripts/demo-personas.ts");
    if (!persona) throw new Error("step has no persona");
    return signers[persona];
  }

  async function loadAliceSkillId(): Promise<string> {
    if (aliceSkillId) return aliceSkillId;
    // The seed is on chain (run via scripts/seed-devnet.ts ahead of time).
    // The indexer projects skills into SQLite; /api/seed returns the id.
    for (let i = 0; i < 30; i++) {
      const seed = await api.seed();
      if (seed?.aliceSkillId) {
        setAliceSkillId(seed.aliceSkillId);
        return seed.aliceSkillId;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error("alice skill not found in indexer — run pnpm tsx scripts/seed-devnet.ts then wait for the indexer to catch up");
  }

  async function runAction(action: string, persona?: PersonaName): Promise<any> {
    const conn = getConnection();

    if (action === "reset_then_seed") {
      await fetch("/api/reset", { method: "POST" });
      await api.indexerTick();
      const skillId = await loadAliceSkillId();
      return { aliceSkillId: skillId };
    }

    if (action === "subscribe_bob" || action === "subscribe_carol") {
      const signer = requireSigner(persona);
      const skillId = await loadAliceSkillId();
      setTxStatus("signing");
      setTxSig(undefined);
      const result = await chainSubscribe(conn, signer, programId, new PublicKey(skillId));
      setTxSig(result.sig);
      setTxStatus("confirmed");
      await refreshSkill();
      return { sig: result.sig };
    }

    if (action === "submit_bob_experience") {
      const signer = requireSigner(persona);
      const skillId = await loadAliceSkillId();
      const skillPk = new PublicKey(skillId);
      const bundle = { ...DEMO_BUNDLE, skill_id: skillId, skill_version: 1 };
      const json = JSON.stringify(bundle);

      // Upload to mock Irys (returns deterministic txId).
      const upload = await api.uploadIrys(signer.publicKey.toBase58(), "demo-mode-no-sig", {
        content: json,
        tags: [
          { name: "Protocol", value: "SLP" },
          { name: "Type", value: "ExperienceBundle" },
          { name: "SkillId", value: skillId },
        ],
      });

      setTxStatus("signing");
      setTxSig(undefined);
      const nextExpId = await getNextExperienceId(conn, programId, skillPk);
      const contentHash = await sha256Bytes(json);
      const result = await chainSubmit(conn, signer, {
        programId,
        skill: skillPk,
        nextExperienceId: nextExpId,
        contentHash,
        arweaveTxId: upload.txId,
        skillVersion: 1,
      });
      setTxSig(result.sig);
      setTxStatus("confirmed");
      setBobExperienceId(nextExpId);
      await refreshSkill();
      return { sig: result.sig, experienceId: nextExpId.toString() };
    }

    if (action === "evaluate") {
      // Judge daemon ticks on a timer; this just nudges it immediately.
      const r = await api.judgeTick();
      // Wait a beat for indexer to project the EvaluationCompleted event.
      await new Promise((r) => setTimeout(r, 2000));
      await refreshSkill();
      return r;
    }

    if (action === "wait_then_settle") {
      const signer = requireSigner(persona);
      const skillId = await loadAliceSkillId();
      const skillPk = new PublicKey(skillId);
      const program = getProgram(conn, signer, programId);
      const [poolPda] = pdas.revenuePool(programId, skillPk);

      // Poll until the on-chain pool's period is over.
      for (let i = 0; i < 90; i++) {
        const poolAcct: any = await (program.account as any).revenuePool.fetch(poolPda);
        const periodStart = Number(poolAcct.currentPeriodStart.toString());
        const periodLen = Number(poolAcct.periodLength.toString());
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec >= periodStart + periodLen) break;
        if (i === 0) pushLog(`  waiting ${periodStart + periodLen - nowSec}s for period to end…`, "info");
        await new Promise((r) => setTimeout(r, 1000));
      }

      const poolAcct: any = await (program.account as any).revenuePool.fetch(poolPda);
      const nextSnapshotId = BigInt(poolAcct.snapshotId.toString()) + 1n;
      const fresh = await api.skill(skillId, null);
      const holders = (fresh.holders ?? [])
        .filter((h: any) => h.shares > 0)
        .map((h: any) => new PublicKey(h.holder));
      if (!holders.length) throw new Error("no shareholders to settle");

      setTxStatus("signing");
      setTxSig(undefined);
      const result = await chainSettle(conn, signer, { programId, skill: skillPk, nextSnapshotId, holders });
      setTxSig(result.sig);
      setTxStatus("confirmed");
      await refreshSkill();
      return { sig: result.sig, snapshotId: nextSnapshotId.toString() };
    }

    if (action === "claim_alice" || action === "claim_bob") {
      const signer = requireSigner(persona);
      const skillId = await loadAliceSkillId();
      const me = await api.me(signer.publicKey.toBase58());
      const claim = (me.claimable ?? []).find((c: any) => c.skillId === skillId);
      if (!claim) throw new Error(`no claimable revenue for ${persona}`);
      setTxStatus("signing");
      setTxSig(undefined);
      const result = await chainClaim(conn, signer, {
        programId,
        skill: new PublicKey(skillId),
        snapshotId: BigInt(claim.snapshotId),
      });
      setTxSig(result.sig);
      setTxStatus("confirmed");
      await refreshSkill();
      return { sig: result.sig, claimedLamports: claim.amount };
    }

    if (action === "publish_v1_1") {
      const signer = requireSigner(persona);
      const skillId = await loadAliceSkillId();
      const skillPk = new PublicKey(skillId);
      // Fetch current version + content from skillData; assemble v2 by appending the patch.
      const program = getProgram(conn, signer, programId);
      const skillAcct: any = await (program.account as any).skill.fetch(skillPk);
      const currentVersion: number = skillAcct.currentVersion;
      const baseContent = skillData?.skill?.name
        ? `# ${skillData.skill.name}\n\n${skillData.skill.description}\n\nStep 1: Load inputs.\nStep 2: Check for common smells.\nStep 3: Produce review.`
        : "# v1\nbase";
      const v2Content = `${baseContent}\n\n## v1.1 patch (Bob)\n${DEMO_BUNDLE.reflection.proposed_patch}\n`;
      const upload = await api.uploadIrys(signer.publicKey.toBase58(), "demo-mode-no-sig", {
        content: v2Content,
        tags: [
          { name: "Protocol", value: "SLP" },
          { name: "Type", value: "SkillContent" },
          { name: "SkillId", value: skillId },
          { name: "Version", value: String(currentVersion + 1) },
        ],
      });
      const expIds = bobExperienceId != null ? [bobExperienceId] : [];
      setTxStatus("signing");
      setTxSig(undefined);
      const result = await chainPublishVersion(conn, signer, {
        programId,
        skill: skillPk,
        currentVersion,
        content: v2Content,
        arweaveTxId: upload.txId,
        contributingExperienceIds: expIds,
      });
      setTxSig(result.sig);
      setTxStatus("confirmed");
      await refreshSkill();
      return { sig: result.sig, version: currentVersion + 1 };
    }

    throw new Error(`unknown action: ${action}`);
  }

  const progress = ((cursor + 1) / STEPS.length) * 100;
  const personasReady = !!signers;

  return (
    <div className="grid grid-cols-12 gap-6 pt-6">
      <header className="col-span-12 flex items-end justify-between">
        <div>
          <div className="caption">DEMO / CONSOLE</div>
          <h1 className="font-display text-display-2 uppercase">Step-through controller</h1>
          <p className="font-mono text-xs text-muted mt-2">
            ← back · → advance · runs the full PRD demo script against devnet. Personas are unlocked from the local vault and sign client-side.
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

      {personasError ? (
        <div className="col-span-12 plate text-accent font-mono text-xs">
          personas not loaded: {personasError}. Set DEMO_MODE=true and run `pnpm tsx scripts/demo-personas.ts`.
        </div>
      ) : null}

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
          <Btn variant="primary" onClick={advance} disabled={running || (!personasReady && !!step.action && step.action !== "reset_then_seed")}>
            {running ? "running…" : step.action ? "Run step →" : "Next →"}
          </Btn>
        </div>
        {pubkeys ? (
          <div className="mt-3 grid grid-cols-1 gap-1 font-mono text-[10px] text-muted">
            <div>alice: <MonoId value={pubkeys.alice} /></div>
            <div>bob: <MonoId value={pubkeys.bob} /></div>
            <div>carol: <MonoId value={pubkeys.carol} /></div>
            <div>judge: <MonoId value={pubkeys.judge} /></div>
          </div>
        ) : null}
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
                <TxStatus status={txStatus} sig={txSig} cluster={cluster} />
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

function jsonReplacer(_k: string, v: any) {
  return typeof v === "bigint" ? v.toString() : v;
}
