"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api-client";
import { fmtSol } from "@/lib/units";
import { signMessage } from "@/lib/wallet";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";
import { Chip } from "@/components/brutalist/Chip";
import { DataPlate } from "@/components/brutalist/DataPlate";
import { MonoId, truncateId } from "@/components/brutalist/MonoId";
import { Rule } from "@/components/brutalist/Rule";
import { PhantomSignPending } from "@/components/brutalist/PhantomSignPending";
import { PeriodCountdown } from "@/components/brutalist/PeriodCountdown";
import { StackedShareBar } from "@/components/charts/StackedShareBar";
import { RevenueBars } from "@/components/charts/RevenueBars";
import { SkillLoopMotif } from "@/components/loop/SkillLoopMotif";

interface PageProps {
  params: { id: string };
}

export default function SkillPage({ params }: PageProps) {
  const w = useWallet();
  const wallet = w.publicKey?.toBase58() ?? null;
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loopTrigger, setLoopTrigger] = useState(0);
  const prevShares = useRef<number | null>(null);

  async function load() {
    try {
      const d = await api.skill(params.id, wallet);
      setData(d);
      if (prevShares.current != null && d.ledger.totalShares > prevShares.current) {
        setLoopTrigger((n) => n + 1);
      }
      prevShares.current = d.ledger.totalShares;
    } catch (e: any) {
      setErr(e?.message ?? "load failed");
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, wallet]);

  const slices = useMemo(() => {
    if (!data) return [];
    return data.holders.map((h: any) => ({
      holder: h.holder,
      label: h.isAuthor ? `${truncateId(h.holder)} · AUTHOR` : truncateId(h.holder),
      shares: h.shares,
      isAuthor: h.isAuthor,
    }));
  }, [data]);

  async function onSubscribe() {
    if (!wallet) return alert("Connect Phantom first");
    setSigning(`Subscribe — ${fmtSol(data.skill.subscriptionPrice, 4)}`);
    try {
      const { signatureBase58 } = await signMessage(
        w,
        `SLP SUBSCRIBE\nskill: ${params.id}\nprice: ${data.skill.subscriptionPrice} lamports\nt: ${Date.now()}`
      );
      await api.subscribe(wallet, signatureBase58, { skill_id: params.id });
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "subscribe failed");
    } finally {
      setSigning(null);
    }
  }

  async function onSettle() {
    if (!wallet) return alert("Connect Phantom first");
    setSigning("Settle period");
    try {
      const { signatureBase58 } = await signMessage(w, `SLP SETTLE\nskill: ${params.id}\nt: ${Date.now()}`);
      await api.settle(wallet, signatureBase58, params.id);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "settle failed");
    } finally {
      setSigning(null);
    }
  }

  async function onPreview() {
    if (!wallet) return alert("Connect Phantom first");
    setSigning("Decrypt via Lit");
    try {
      const { signatureBase58 } = await signMessage(w, `SLP DECRYPT\nskill: ${params.id}\nt: ${Date.now()}`);
      const arweave = await api.fetchIrys(data.skill.arweaveTxId);
      const r = await api.litDecrypt(wallet, signatureBase58, { ciphertext: arweave.content, skillId: params.id });
      setPreview(r.plaintext);
    } catch (e: any) {
      setErr(e?.message ?? "decrypt failed");
    } finally {
      setSigning(null);
    }
  }

  if (!data) return <div className="pt-10 font-mono text-sm">{err ? `error: ${err}` : "loading…"}</div>;

  const { skill, ledger, holders, versions, pool, history, experiences, caller: callerInfo } = data;
  const accessChip = callerInfo.isAuthor ? (
    <Chip tone="ink">AUTHOR</Chip>
  ) : callerInfo.isShareholder ? (
    <Chip tone="accent">SHAREHOLDER</Chip>
  ) : callerInfo.isSubscriber ? (
    <Chip tone="ink">SUBSCRIBER</Chip>
  ) : (
    <Chip tone="muted">PUBLIC</Chip>
  );

  return (
    <div className="grid grid-cols-12 gap-6 pt-6">
      {/* Header band */}
      <section className="col-span-12 border border-ink bg-paper-raised">
        <div className="grid grid-cols-12 items-stretch">
          <div className="col-span-12 lg:col-span-8 p-6">
            <div className="flex items-center gap-3 mb-3">
              <Chip tone="ghost">{skill.category}</Chip>
              <Chip tone="muted">v{skill.currentVersion}</Chip>
              {accessChip}
            </div>
            <h1 className="font-display text-display-2 uppercase leading-[1]">{skill.name}</h1>
            <p className="font-serif text-lg mt-3 leading-[1.35] max-w-2xl">{skill.description}</p>
            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <DataPlate label="subscription" value={fmtSol(skill.subscriptionPrice, 3) + " / 30d"} />
              <DataPlate label="subscribers" value={skill.subscriberCount.toString()} />
              <DataPlate label="holders" value={(ledger.contributorCount + 1).toString()} />
              <DataPlate label="lifetime rev" value={fmtSol(pool.totalLifetimeRevenue + pool.currentPeriodRevenue, 3)} />
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <MonoId value={skill.skillId} prefix="skill" />
              <MonoId value={skill.author} prefix="author" />
              <MonoId value={skill.arweaveTxId} prefix="ar" />
              {!callerInfo.isSubscriber && !callerInfo.isAuthor ? (
                <Btn variant="primary" onClick={onSubscribe}>Subscribe</Btn>
              ) : callerInfo.isSubscriber ? (
                <Btn variant="ghost" onClick={onPreview}>Decrypt · preview</Btn>
              ) : null}
            </div>
          </div>
          <div className="col-span-12 lg:col-span-4 border-t lg:border-t-0 lg:border-l border-ink bg-paper flex items-center justify-center p-4">
            <SkillLoopMotif size={260} spinTrigger={loopTrigger} />
          </div>
        </div>
      </section>

      {/* Cap table */}
      <LabeledBox title="CAP TABLE" code="§ shares" className="col-span-12" right={<span>{ledger.totalShares.toLocaleString()} total · floor {(ledger.minAuthorRatioBps / 100).toFixed(0)}%</span>}>
        <StackedShareBar slices={slices} totalShares={ledger.totalShares} minAuthorRatioBps={ledger.minAuthorRatioBps} />
      </LabeledBox>

      {/* Revenue panel */}
      <LabeledBox title="REVENUE POOL" code="§ distribute" className="col-span-12 lg:col-span-7">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <DataPlate label="current period" value={fmtSol(pool.currentPeriodRevenue, 4)} />
          <DataPlate label="lifetime" value={fmtSol(pool.totalLifetimeRevenue, 4)} />
          <DataPlate label="period length" value={`${pool.periodLength}s`} />
        </div>
        <div className="mb-4">
          <PeriodCountdown startUnix={pool.currentPeriodStart} periodLength={pool.periodLength} />
        </div>
        <div className="flex items-center gap-3 mb-4">
          <Btn variant="ink" onClick={onSettle}>Settle period</Btn>
          <span className="caption">period must elapse before settle succeeds</span>
        </div>
        <Rule />
        <div className="mt-4">
          <div className="caption mb-2">HISTORY · SETTLED PERIODS</div>
          <RevenueBars data={history.map((h: any) => ({ periodStart: h.periodStart, revenue: h.revenue }))} />
        </div>
      </LabeledBox>

      {/* Versions */}
      <LabeledBox title="VERSIONS" code="§ evolve" className="col-span-12 lg:col-span-5">
        <ul className="flex flex-col gap-3">
          {versions.map((v: any) => (
            <li key={v.version} className="border border-ink/30 p-3">
              <div className="flex items-center justify-between">
                <span className="font-display uppercase text-lg">v{v.version}</span>
                <span className="caption">{new Date(v.publishedAt * 1000).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <MonoId value={v.arweaveTxId} prefix="ar" />
                <span className="caption">{v.contributingExperienceIds.length} contributor(s)</span>
              </div>
            </li>
          ))}
        </ul>
      </LabeledBox>

      {/* Experiences */}
      <LabeledBox title="CONTRIBUTION TIMELINE" code="§ experiences" className="col-span-12">
        {experiences.length === 0 ? (
          <div className="font-mono text-xs text-muted italic">no experiences submitted yet.</div>
        ) : (
          <ul className="flex flex-col">
            {experiences.map((e: any, i: number) => (
              <li key={e.experienceId} className={i > 0 ? "border-t border-ink/20" : ""}>
                <ExperienceRow exp={e} />
              </li>
            ))}
          </ul>
        )}
      </LabeledBox>

      {/* Preview modal */}
      {preview ? (
        <div className="fixed inset-0 z-40 bg-paper/80 backdrop-blur-sm flex items-center justify-center p-6" onClick={() => setPreview(null)}>
          <div className="corner-box border border-ink bg-paper max-w-3xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between px-4 py-2 border-b border-ink">
              <span className="caption">SKILL.md · DECRYPTED</span>
              <button className="caption hover:text-accent" onClick={() => setPreview(null)}>close</button>
            </header>
            <pre className="p-4 font-mono text-xs whitespace-pre-wrap leading-5">{preview.slice(0, 5000)}</pre>
          </div>
        </div>
      ) : null}

      <PhantomSignPending open={!!signing} label={signing ?? ""} />
    </div>
  );
}

function ExperienceRow({ exp }: { exp: any }) {
  const [open, setOpen] = useState(false);
  const tone = exp.status === "Evaluated" ? "accent" : exp.status === "Pending" ? "muted" : "ghost";
  return (
    <div>
      <button className="w-full flex items-center justify-between px-2 py-3 hover:bg-paper-raised" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted w-8">#{exp.experienceId}</span>
          <MonoId value={exp.contributor} prefix="by" />
          <Chip tone={tone}>{exp.status}</Chip>
          {exp.contributionScore ? <Chip tone="ink">{exp.contributionScore} / 50</Chip> : null}
          {exp.sharesMinted ? <span className="font-mono text-[11px] text-accent">+{exp.sharesMinted} shares</span> : null}
        </div>
        <div className="flex items-center gap-3">
          <span className="caption">{new Date(exp.submittedAt * 1000).toLocaleTimeString()}</span>
          <span className="caption">{open ? "—" : "+"}</span>
        </div>
      </button>
      {open ? (
        <div className="bg-paper-raised px-4 py-3 border-t border-ink/20">
          {exp.bundle ? (
            <pre className="font-mono text-[11px] whitespace-pre-wrap leading-5 max-h-[360px] overflow-auto">
{JSON.stringify(exp.bundle, null, 2)}
            </pre>
          ) : (
            <div className="font-mono text-[11px] text-muted">
              Bundle content is shareholder-only. {exp.arweaveTxId ? <>Fetch directly: <MonoId value={exp.arweaveTxId} /></> : null}
            </div>
          )}
          {exp.judgeReport ? (
            <div className="mt-4">
              <div className="caption mb-1">JUDGE REPORT</div>
              <pre className="font-mono text-[11px] whitespace-pre-wrap leading-5 max-h-[280px] overflow-auto">
{JSON.stringify(exp.judgeReport, null, 2)}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
