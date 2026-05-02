"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { ExperienceBundleSchema } from "@/lib/schemas";
import { api } from "@/lib/api-client";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";
import { Chip } from "@/components/brutalist/Chip";
import { MonoId } from "@/components/brutalist/MonoId";
import { PhantomSignPending } from "@/components/brutalist/PhantomSignPending";
import { TxStatus } from "@/components/brutalist/TxStatus";
import { getConnection } from "@/lib/chain/connection";
import { getChainConfig } from "@/lib/chain/config";
import { submitExperience as chainSubmit, getNextExperienceId } from "@/lib/chain/tx";
import { uploadObject } from "@/lib/browser-irys";

type SkillOption = {
  skillId: string;
  author: string;
  name: string;
  description: string;
  category: string;
  currentVersion: number;
  subscriberCount?: number;
  confidence?: "exact" | "fuzzy";
};

type ResolveResult = {
  status: "no_match" | "single_exact" | "multiple_exact" | "fuzzy";
  autoSelectableSkillId: string | null;
  candidates: SkillOption[];
};

async function sha256Bytes(content: string): Promise<Uint8Array> {
  const buf = new TextEncoder().encode(content);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return new Uint8Array(digest);
}

export default function SubmitPage() {
  const w = useWallet();
  const wallet = w.publicKey?.toBase58() ?? null;
  const router = useRouter();
  const [querySkillId, setQuerySkillId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [skillSearch, setSkillSearch] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [targetConfirmed, setTargetConfirmed] = useState(false);
  const [resolveResult, setResolveResult] = useState<ResolveResult | null>(null);
  const [resolveErr, setResolveErr] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "signing" | "confirming" | "confirmed" | "error">("idle");
  const [txSig, setTxSig] = useState<string | undefined>();

  const validation = useMemo(() => {
    if (!text.trim()) return { ok: false as const, errors: [] as string[], bundle: null };
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch (e: any) {
      return { ok: false as const, errors: [`JSON parse: ${e.message}`], bundle: null };
    }
    const r = ExperienceBundleSchema.safeParse(parsed);
    if (!r.success) {
      return {
        ok: false as const,
        errors: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
        bundle: null,
      };
    }
    return { ok: true as const, errors: [], bundle: r.data };
  }, [text]);

  const target = validation.ok ? validation.bundle.target_skill : null;
  const targetName = target?.name ?? "";
  const targetVersion = target?.version ?? (validation.ok ? validation.bundle.skill_version : undefined);

  useEffect(() => {
    setQuerySkillId(new URLSearchParams(window.location.search).get("skill_id"));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.listSkills({ sort: "recent" })
      .then((rows) => {
        if (cancelled) return;
        setSkills(rows);
        if (querySkillId) setSelectedSkillId(querySkillId);
      })
      .catch((e: any) => {
        if (!cancelled) setResolveErr(e?.message ?? "skills_load_failed");
      });
    return () => { cancelled = true; };
  }, [querySkillId]);

  useEffect(() => {
    setTargetConfirmed(false);
    setResolveResult(null);
    setResolveErr(null);
    if (!targetName) return;
    let cancelled = false;
    api.resolveSkill({ name: targetName, version: targetVersion })
      .then((result) => {
        if (cancelled) return;
        setResolveResult(result);
        setSelectedSkillId((prev) => prev ?? result.autoSelectableSkillId);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setResolveErr(e?.message ?? "skill_resolve_failed");
      });
    return () => { cancelled = true; };
  }, [targetName, targetVersion]);

  const selectedSkill = useMemo(() => {
    if (!selectedSkillId) return null;
    return (
      skills.find((s) => s.skillId === selectedSkillId) ??
      resolveResult?.candidates.find((s) => s.skillId === selectedSkillId) ??
      null
    );
  }, [resolveResult, selectedSkillId, skills]);

  const listedSkills = useMemo(() => {
    const q = skillSearch.trim().toLowerCase();
    if (!q) return skills.slice(0, 12);
    return skills
      .filter((s) =>
        `${s.name} ${s.category} ${s.author} ${s.skillId}`.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [skillSearch, skills]);

  const candidates = resolveResult?.candidates ?? [];
  const canSubmit = Boolean(wallet && validation.ok && selectedSkill && targetConfirmed);

  function chooseSkill(skillId: string) {
    setSelectedSkillId(skillId);
    setTargetConfirmed(false);
  }

  async function onSubmit() {
    if (!wallet) return alert("Connect Phantom first");
    if (!validation.ok) return;
    if (!selectedSkill) return;
    if (!targetConfirmed) return;
    const bundle = validation.bundle;
    const json = JSON.stringify(bundle);
    setErr(null);
    setTxStatus("idle");
    setTxSig(undefined);
    try {
      setSigning("Upload to Irys");
      const upload = await uploadObject({
        owner: wallet,
        wallet: w,
        content: json,
        tags: [
          { name: "Protocol", value: "SLP" },
          { name: "Type", value: "ExperienceBundle" },
          { name: "SkillId", value: selectedSkill.skillId },
          { name: "SkillName", value: selectedSkill.name },
        ],
      });
      setSigning(null);

      setTxStatus("signing");
      const { programId } = getChainConfig();
      const conn = getConnection();
      const skillPk = new PublicKey(selectedSkill.skillId);
      const nextExpId = await getNextExperienceId(conn, programId, skillPk);
      const contentHash = await sha256Bytes(json);
      const result = await chainSubmit(conn, w as any, {
        programId,
        skill: skillPk,
        nextExperienceId: nextExpId,
        contentHash,
        arweaveTxId: upload.txId,
        skillVersion: bundle.skill_version,
      });
      setTxSig(result.sig);
      setTxStatus("confirmed");
      router.push(`/me?tab=contributions&expId=${nextExpId.toString()}`);
    } catch (e: any) {
      setErr(e?.message ?? "submit failed");
      setTxStatus("error");
    } finally {
      setSigning(null);
    }
  }

  return (
    <div className="grid grid-cols-12 gap-6 pt-6">
      <header className="col-span-12 pb-2">
        <div className="caption mb-2">CONTRIBUTOR / SUBMIT</div>
        <h1 className="font-display text-display-2 uppercase">Submit an ExperienceBundle</h1>
        <p className="font-serif text-lg mt-2 max-w-2xl">
          Pick the target skill, paste the Reflection Skill JSON, confirm the match, then sign.
        </p>
      </header>

      <LabeledBox title="TARGET SKILL" code="§ choose" className="col-span-12 lg:col-span-5">
        <div className="flex flex-col gap-4">
          <input
            className="plate w-full font-mono text-xs"
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            placeholder="search skills by name, category, author, or pubkey"
          />

          {targetName ? (
            <div className="border border-ink bg-paper-raised p-3">
              <div className="caption mb-2">BUNDLE TARGET</div>
              <div className="font-display text-lg uppercase leading-tight">{targetName}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip tone="muted">v{targetVersion}</Chip>
                {resolveResult ? <Chip tone={resolveResult.status === "single_exact" ? "accent" : "ghost"}>{resolveResult.status}</Chip> : null}
              </div>
            </div>
          ) : null}

          {candidates.length ? (
            <div>
              <div className="caption mb-2">MATCHES FROM BUNDLE</div>
              <div className="flex flex-col border border-ink">
                {candidates.map((s) => (
                  <SkillButton
                    key={s.skillId}
                    skill={s}
                    selected={s.skillId === selectedSkillId}
                    onClick={() => chooseSkill(s.skillId)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <div className="caption mb-2">ALL SKILLS</div>
            <div className="flex max-h-[360px] flex-col overflow-auto border border-ink">
              {listedSkills.map((s) => (
                <SkillButton
                  key={s.skillId}
                  skill={s}
                  selected={s.skillId === selectedSkillId}
                  onClick={() => chooseSkill(s.skillId)}
                />
              ))}
              {listedSkills.length === 0 ? (
                <div className="p-3 font-mono text-xs text-muted">no skills found</div>
              ) : null}
            </div>
          </div>
        </div>
      </LabeledBox>

      <LabeledBox title="BUNDLE JSON" code="§ paste" className="col-span-12 lg:col-span-7">
        <textarea
          className="plate w-full font-mono text-xs min-h-[480px]"
          placeholder='paste your ExperienceBundle JSON here…'
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Btn variant="primary" onClick={onSubmit} disabled={!canSubmit}>
            {wallet ? "Sign & submit" : "Connect wallet to submit"}
          </Btn>
          <span className="caption">Irys upload · confirmed skill target · Phantom tx</span>
        </div>
        {err ? <div className="plate text-accent mt-3">error: {err}</div> : null}
        <TxStatus status={txStatus} sig={txSig} cluster={getChainConfig().cluster} error={err ?? undefined} />
      </LabeledBox>

      <aside className="col-span-12 flex flex-col gap-4 lg:grid lg:grid-cols-12">
        <LabeledBox title="VALIDATION" code="§ zod" className="lg:col-span-4">
          {text.trim() === "" ? (
            <div className="font-mono text-xs text-muted">waiting for paste…</div>
          ) : validation.ok ? (
            <div>
              <div className="caption mb-2 text-accent">VALID ✓</div>
              <ul className="font-mono text-xs flex flex-col gap-1">
                <li>target: <span className="text-ink">{validation.bundle.target_skill.name}</span></li>
                <li>version: <span className="text-ink">{validation.bundle.skill_version}</span></li>
                <li>trace: <span className="text-ink">{validation.bundle.trace_id}</span></li>
                <li>trajectory steps: {validation.bundle.trajectory.length}</li>
              </ul>
            </div>
          ) : (
            <ul className="font-mono text-xs flex flex-col gap-1 text-accent">
              {validation.errors.slice(0, 8).map((e, i) => (
                <li key={i}>✗ {e}</li>
              ))}
            </ul>
          )}
        </LabeledBox>
        <LabeledBox title="CONFIRM" code="§ target" className="lg:col-span-8">
          {selectedSkill ? (
            <div className="flex flex-col gap-3">
              <div className="grid gap-2 font-mono text-xs sm:grid-cols-2">
                <div>
                  <div className="caption mb-1">BUNDLE SAYS</div>
                  <div className="text-ink">{targetName || "no target parsed"}</div>
                </div>
                <div>
                  <div className="caption mb-1">SUBMIT TO</div>
                  <div className="text-ink">{selectedSkill.name}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Chip tone="ink">{selectedSkill.category}</Chip>
                <Chip tone="muted">v{selectedSkill.currentVersion}</Chip>
                <MonoId value={selectedSkill.skillId} prefix="skill" />
              </div>
              <label className="flex items-start gap-3 border border-ink bg-paper-raised p-3 font-mono text-xs">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={targetConfirmed}
                  onChange={(e) => setTargetConfirmed(e.target.checked)}
                />
                <span>I confirm this ExperienceBundle should be submitted to this skill.</span>
              </label>
            </div>
          ) : (
            <div className="font-mono text-xs text-muted">
              Select a target skill before signing. {resolveErr ? <span className="text-accent">resolver: {resolveErr}</span> : null}
            </div>
          )}
        </LabeledBox>
      </aside>

      <PhantomSignPending open={!!signing} label={signing ?? ""} />
    </div>
  );
}

function SkillButton({
  skill,
  selected,
  onClick,
}: {
  skill: SkillOption;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`border-b border-ink/20 p-3 text-left last:border-b-0 hover:bg-paper-raised ${selected ? "bg-accent text-ink" : "bg-paper"}`}
      onClick={onClick}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-display text-sm uppercase leading-tight">{skill.name}</span>
        <Chip tone={skill.confidence === "exact" ? "accent" : "muted"}>{skill.confidence ?? skill.category}</Chip>
        <Chip tone="ghost">v{skill.currentVersion}</Chip>
      </div>
      <div className="mt-2 line-clamp-2 font-serif text-sm leading-5 text-ink/75">{skill.description}</div>
      <div className="mt-2">
        <MonoId value={skill.skillId} prefix="skill" />
      </div>
    </button>
  );
}
