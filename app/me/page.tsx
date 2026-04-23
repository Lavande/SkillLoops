"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { api } from "@/lib/api-client";
import { fmtSol } from "@/lib/units";
import { signMessage } from "@/lib/wallet";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";
import { Chip } from "@/components/brutalist/Chip";
import { MonoId, truncateId } from "@/components/brutalist/MonoId";
import { DataPlate } from "@/components/brutalist/DataPlate";
import { PhantomSignPending } from "@/components/brutalist/PhantomSignPending";

const TABS = ["Overview", "Published", "Subscriptions", "Holdings", "Contributions", "Claimable"] as const;
type Tab = typeof TABS[number];

export default function MePage() {
  const w = useWallet();
  const wallet = w.publicKey?.toBase58() ?? null;
  const search = useSearchParams();
  const expIdParam = search.get("expId");
  const tabParam = (search.get("tab") ?? "overview").toLowerCase();
  const initialTab = (TABS.find((t) => t.toLowerCase() === tabParam) ?? "Overview") as Tab;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [signing, setSigning] = useState<string | null>(null);

  async function load() {
    if (!wallet) {
      setData(null);
      return;
    }
    try {
      setData(await api.me(wallet));
    } catch (e: any) {
      setErr(e?.message ?? "load failed");
    }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  async function onClaim(skillId: string) {
    if (!wallet) return;
    setSigning("Approve claim");
    try {
      const { signatureBase58 } = await signMessage(w, `SLP CLAIM\nskill: ${skillId}\nt: ${Date.now()}`);
      await api.claim(wallet, signatureBase58, skillId);
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "claim failed");
    } finally {
      setSigning(null);
    }
  }

  if (!wallet) {
    return (
      <div className="pt-16 font-mono text-sm text-muted">
        connect your Phantom wallet to view your dashboard.
      </div>
    );
  }
  if (!data) return <div className="pt-10 font-mono text-sm">{err ? `error: ${err}` : "loading…"}</div>;

  return (
    <div className="grid grid-cols-12 gap-6 pt-6">
      <header className="col-span-12 flex items-end justify-between">
        <div>
          <div className="caption">ME</div>
          <div className="flex items-center gap-3 mt-1">
            <MonoId value={data.wallet} prefix="wallet" />
            <span className="font-display text-2xl uppercase">{fmtSol(data.balance, 4)}</span>
            <Chip tone="muted">balance</Chip>
          </div>
        </div>
        <nav className="flex border border-ink bg-paper-raised">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] border-r border-ink last:border-r-0 ${
                tab === t ? "bg-ink text-paper" : ""
              }`}
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      {tab === "Overview" ? (
        <section className="col-span-12 grid grid-cols-5 gap-4">
          <DataPlate label="published" value={data.published.length.toString()} />
          <DataPlate label="subscriptions" value={data.subscriptions.length.toString()} />
          <DataPlate label="holdings" value={data.holdings.length.toString()} />
          <DataPlate label="contributions" value={data.contributions.length.toString()} />
          <DataPlate label="claimable" value={fmtSol(data.claimable.reduce((s: number, r: any) => s + r.amount, 0), 4)} />
        </section>
      ) : null}

      {tab === "Published" ? (
        <LabeledBox title="MY PUBLISHED SKILLS" className="col-span-12">
          {data.published.length === 0 ? <Empty text="You haven't published anything yet." link={{ href: "/publish", label: "publish →" }} /> : <Tbl rows={data.published} cols={[
            { k: "name", label: "name", render: (r: any) => <Link className="accent-underline" href={`/skill/${r.skillId}`}>{r.name}</Link> },
            { k: "category", label: "category" },
            { k: "currentVersion", label: "ver" },
            { k: "subscriberCount", label: "subs" },
            { k: "totalShares", label: "shares" },
            { k: "subscriptionPrice", label: "price", render: (r: any) => fmtSol(r.subscriptionPrice, 3) },
          ]} />}
        </LabeledBox>
      ) : null}

      {tab === "Subscriptions" ? (
        <LabeledBox title="ACTIVE SUBSCRIPTIONS" className="col-span-12">
          {data.subscriptions.length === 0 ? <Empty text="No subscriptions yet." link={{ href: "/market", label: "market →" }} /> : <Tbl rows={data.subscriptions} cols={[
            { k: "name", label: "skill", render: (r: any) => <Link className="accent-underline" href={`/skill/${r.skillId}`}>{r.name}</Link> },
            { k: "category", label: "category" },
            { k: "startTime", label: "start", render: (r: any) => new Date(r.startTime * 1000).toLocaleString() },
            { k: "expiryTime", label: "expiry", render: (r: any) => new Date(r.expiryTime * 1000).toLocaleString() },
            { k: "isActive", label: "active", render: (r: any) => r.isActive ? <Chip tone="accent">yes</Chip> : <Chip tone="muted">no</Chip> },
          ]} />}
        </LabeledBox>
      ) : null}

      {tab === "Holdings" ? (
        <LabeledBox title="SHARE HOLDINGS" className="col-span-12">
          {data.holdings.length === 0 ? <Empty text="No nonzero share positions yet. Subscribe and contribute to earn shares." /> : <Tbl rows={data.holdings} cols={[
            { k: "skillName", label: "skill", render: (r: any) => <Link className="accent-underline" href={`/skill/${r.skillId}`}>{r.skillName}</Link> },
            { k: "shares", label: "shares" },
            { k: "totalShares", label: "total" },
            { k: "pct", label: "%", render: (r: any) => r.totalShares ? ((r.shares / r.totalShares) * 100).toFixed(2) + "%" : "—" },
            { k: "lockUntil", label: "unlocks", render: (r: any) => r.lockUntil ? new Date(r.lockUntil * 1000).toLocaleDateString() : "—" },
          ]} />}
        </LabeledBox>
      ) : null}

      {tab === "Contributions" ? (
        <LabeledBox title="MY CONTRIBUTIONS" className="col-span-12">
          {data.contributions.length === 0 ? <Empty text="Haven't submitted any experiences yet." link={{ href: "/submit", label: "submit →" }} /> : <Tbl rows={data.contributions} highlightId={expIdParam ? Number(expIdParam) : null} cols={[
            { k: "experienceId", label: "id", render: (r: any) => `#${r.experienceId}` },
            { k: "skillName", label: "skill", render: (r: any) => <Link className="accent-underline" href={`/skill/${r.skillId}`}>{r.skillName}</Link> },
            { k: "status", label: "status", render: (r: any) => <Chip tone={r.status === "Evaluated" ? "accent" : r.status === "Pending" ? "muted" : "ghost"}>{r.status}</Chip> },
            { k: "contributionScore", label: "score", render: (r: any) => r.contributionScore ? `${r.contributionScore}/50` : "—" },
            { k: "sharesMinted", label: "minted", render: (r: any) => r.sharesMinted ? `+${r.sharesMinted}` : "—" },
            { k: "submittedAt", label: "submitted", render: (r: any) => new Date(r.submittedAt * 1000).toLocaleString() },
          ]} />}
        </LabeledBox>
      ) : null}

      {tab === "Claimable" ? (
        <LabeledBox title="CLAIMABLE REVENUE" className="col-span-12">
          {data.claimable.length === 0 ? <Empty text="Nothing to claim right now." /> : (
            <ul className="flex flex-col">
              {data.claimable.map((c: any, i: number) => (
                <li key={`${c.skillId}.${c.snapshotId}`} className={`flex items-center justify-between px-2 py-3 ${i > 0 ? "border-t border-ink/20" : ""}`}>
                  <div className="flex items-center gap-4">
                    <Link className="accent-underline font-display uppercase text-lg" href={`/skill/${c.skillId}`}>{c.skillName}</Link>
                    <Chip tone="muted">snapshot #{c.snapshotId}</Chip>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm">{fmtSol(c.amount, 6)}</span>
                    <Btn variant="primary" onClick={() => onClaim(c.skillId)}>Claim</Btn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </LabeledBox>
      ) : null}

      <PhantomSignPending open={!!signing} label={signing ?? ""} />
    </div>
  );
}

function Empty({ text, link }: { text: string; link?: { href: string; label: string } }) {
  return (
    <div className="font-mono text-xs text-muted">
      {text} {link ? <Link className="accent-underline text-ink" href={link.href}>{link.label}</Link> : null}
    </div>
  );
}

function Tbl({ rows, cols, highlightId }: { rows: any[]; cols: any[]; highlightId?: number | null }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse font-mono text-[11px]">
        <thead>
          <tr className="text-left border-b border-ink">
            {cols.map((c: any) => (
              <th key={c.label} className="pb-2 pr-4 caption font-normal">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i} className={`border-b border-ink/15 ${highlightId && r.experienceId === highlightId ? "bg-accent/10" : ""}`}>
              {cols.map((c: any) => (
                <td key={c.label} className="py-3 pr-4 align-top">
                  {c.render ? c.render(r) : r[c.k]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
