"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { fmtSol } from "@/lib/units";
import { SeedBanner } from "@/components/brutalist/SeedBanner";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { MonoId, truncateId } from "@/components/brutalist/MonoId";
import { Chip } from "@/components/brutalist/Chip";

const CATEGORIES = ["all", "code-review", "ops", "database", "docs", "api"];
const SORTS = [
  { value: "subscribers", label: "Subscribers" },
  { value: "holders", label: "Holders" },
  { value: "recent", label: "Recent" },
  { value: "price", label: "Price" },
];

export default function MarketPage() {
  const [rows, setRows] = useState<any[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [cat, setCat] = useState("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("subscribers");

  async function load() {
    setErr(null);
    try {
      const data = await api.listSkills({
        category: cat === "all" ? undefined : cat,
        q: q || undefined,
        sort,
      });
      setRows(data);
    } catch (e: any) {
      setErr(e?.message ?? "load failed");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, sort]);

  return (
    <div className="flex flex-col gap-6 pt-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="caption mb-2">MARKET INDEX</div>
          <h1 className="font-display text-display-2 uppercase">All skills on SLP</h1>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <input
            className="plate w-full focus:outline-none sm:w-64"
            placeholder="search by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
          />
          <select
            className="plate w-full sm:w-auto"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                sort: {s.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <nav className="flex gap-2 flex-wrap">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`font-mono text-[11px] uppercase tracking-[0.18em] border border-ink px-3 py-1 ${
              cat === c ? "bg-ink text-paper" : "bg-paper hover:bg-paper-raised"
            }`}
          >
            {c}
          </button>
        ))}
      </nav>

      {rows?.length === 0 ? <SeedBanner onSeeded={load} /> : null}

      {err ? (
        <div className="plate text-accent">error: {err}</div>
      ) : null}

      <ul className="grid grid-cols-12 gap-4">
        {rows?.map((r) => (
          <li key={r.skillId} className="col-span-12 md:col-span-6 xl:col-span-4">
            <SkillCard r={r} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SkillCard({ r }: { r: any }) {
  const authorPct = r.authorOwnershipPct ?? 100;
  return (
    <Link href={`/skill/${r.skillId}`} className="block">
      <article className="border border-ink bg-paper hover:bg-paper-raised transition-colors relative">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink px-4 py-2">
          <Chip tone="ink">{r.category}</Chip>
          <span className="font-mono text-[10px] text-muted uppercase tracking-[0.2em]">v{r.currentVersion}</span>
        </header>
        <div className="p-4">
          <h3 className="font-display uppercase text-xl leading-tight">{r.name}</h3>
          <p className="font-mono text-xs text-ink/80 mt-1 line-clamp-2 min-h-[2.4em]">{r.description}</p>
          <div className="mt-4 grid grid-cols-3 gap-3 font-mono text-[11px]">
            <StatCell label="price" value={fmtSol(r.subscriptionPrice, 3)} />
            <StatCell label="subs" value={r.subscriberCount.toString()} />
            <StatCell label="holders" value={(r.contributorCount + 1).toString()} />
          </div>
          <div className="mt-4">
            <div className="caption mb-1">AUTHOR SHARE</div>
            <div className="relative h-[8px] border border-ink bg-paper-raised">
              <div className="absolute left-0 top-0 bottom-0 bg-ink" style={{ width: `${authorPct}%` }} />
              <div
                className="absolute top-0 bottom-0 w-px bg-accent"
                style={{ left: `${r.minAuthorRatioBps / 100}%` }}
              />
            </div>
            <div className="caption mt-1 flex items-center justify-between">
              <span>{authorPct.toFixed(1)}% author</span>
              <span>floor {(r.minAuthorRatioBps / 100).toFixed(0)}%</span>
            </div>
          </div>
          <footer className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <MonoId value={r.author} prefix="by" />
            <span className="accent-underline font-mono text-[10px] uppercase tracking-[0.2em]">open →</span>
          </footer>
        </div>
      </article>
    </Link>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="caption">{label}</span>
      <span>{value}</span>
    </div>
  );
}
