import Link from "next/link";
import { SkillLoopMotif } from "@/components/loop/SkillLoopMotif";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";
import { Chip } from "@/components/brutalist/Chip";

export default function Home() {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* ───────────────── HERO ───────────────── */}
      <header className="col-span-12 pt-10 pb-8 border-b border-ink">
        <div className="flex items-center justify-between gap-6 mb-8">
          <div className="caption flex items-center gap-3">
            <span>PROTOCOL SPEC / HACKATHON MVP</span>
            <span className="text-ink/30">·</span>
            <span>SOLANA · DEVNET</span>
            <span className="text-ink/30">·</span>
            <span>FILED 2026-04</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <Chip tone="ghost">DOC SLP-001</Chip>
            <Chip tone="accent">LIVE</Chip>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 items-end">
          <div className="col-span-12 md:col-span-8">
            <h1 className="font-display text-display-1 uppercase tracking-[-0.01em] leading-[0.92]">
              Buying a skill<br />is opting in at<br />
              <span className="text-accent">zero shares</span>.
            </h1>
            <p className="font-serif text-xl mt-6 leading-[1.35] max-w-xl">
              Skill Loops Protocol is a Solana-based market where every buyer of an AI agent skill is
              automatically a potential shareholder. Contribute usage experience to earn shares. All
              shareholders share the skill&apos;s future revenue, forever.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link href="/market"><Btn variant="primary">Enter market</Btn></Link>
              <Link href="/publish"><Btn variant="ghost">Publish a skill</Btn></Link>
              <Link href="/reflection-skill"><Btn variant="ink">Get Reflection Skill</Btn></Link>
            </div>
          </div>

          <div className="col-span-12 md:col-span-4 hidden md:flex justify-end">
            <SkillLoopMotif size={280} />
          </div>
        </div>

        {/* spec strip */}
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-0 border border-ink bg-paper-raised">
          {SPEC_STRIP.map((s, i) => (
            <div
              key={s.label}
              className={
                "px-4 py-3 flex flex-col gap-1 " +
                (i < SPEC_STRIP.length - 1 ? "border-r border-ink " : "") +
                "border-b md:border-b-0 border-ink"
              }
            >
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted">{s.label}</span>
              <span className="font-display text-lg uppercase tracking-[0.04em]">{s.value}</span>
              <span className="font-mono text-[10px] text-ink/60">{s.hint}</span>
            </div>
          ))}
        </div>
      </header>

      {/* ───────────────── BEATS ───────────────── */}
      <section className="col-span-12 grid grid-cols-12 gap-6 pt-10 pb-2">
        <div className="col-span-12 flex items-baseline justify-between mb-1">
          <div className="flex items-baseline gap-3">
            <span className="caption">§ 01</span>
            <h2 className="font-display text-2xl uppercase tracking-[0.04em]">Four invariants of the protocol</h2>
          </div>
          <span className="caption hidden md:inline">read top-to-bottom</span>
        </div>
        {BEATS.map((b, i) => (
          <LabeledBox
            key={i}
            title={b.title}
            code={`// ${String(i + 1).padStart(2, "0")}`}
            className="col-span-12 md:col-span-6 lg:col-span-3"
          >
            <p className="font-mono text-xs leading-5 text-ink/85">{b.body}</p>
          </LabeledBox>
        ))}
      </section>

      {/* ───────────────── CENTERPIECE ───────────────── */}
      <section className="col-span-12 border border-ink bp-grid mt-4">
        <div className="grid grid-cols-12 gap-0 items-stretch">
          <div className="col-span-12 md:col-span-5 p-8 border-b md:border-b-0 md:border-r border-ink bg-paper">
            <div className="caption">SPEC / CENTERPIECE</div>
            <h2 className="font-display text-display-2 mt-2 uppercase leading-[1]">A fully AI-native economy.</h2>
            <p className="font-serif text-lg mt-4 leading-[1.4]">
              AI skills. AI agents. AI judges. No human gatekeeper in the hot path. The client is itself a
              skill — the Reflection Skill — so any agent host that understands skills can participate with
              zero integration work.
            </p>
            <ul className="mt-6 space-y-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/85">
              <li>→ AGENT runs a target skill</li>
              <li>→ AGENT reflects, drafts a patch</li>
              <li>→ AI JUDGE scores it on five dimensions</li>
              <li>→ CONTRACT mints contribution shares</li>
              <li>→ POOL settles revenue to all holders</li>
            </ul>
            <div className="mt-7 flex items-center gap-4">
              <Link href="/console" className="accent-underline font-mono text-[11px] uppercase tracking-[0.2em]">
                See the live demo console →
              </Link>
              <Link href="/market" className="accent-underline font-mono text-[11px] uppercase tracking-[0.2em]">
                Browse skills →
              </Link>
            </div>
          </div>
          <div className="col-span-12 md:col-span-7 bg-paper-raised p-6 flex items-center justify-center">
            <SkillLoopMotif size={420} active="REFLECT" />
          </div>
        </div>
      </section>

      {/* ───────────────── HOW THE LOOP WORKS ───────────────── */}
      <section className="col-span-12 pt-14">
        <div className="flex items-baseline justify-between mb-6">
          <div className="flex items-baseline gap-3">
            <span className="caption">§ 02</span>
            <h2 className="font-display text-2xl uppercase tracking-[0.04em]">How a single loop closes</h2>
          </div>
          <span className="caption hidden md:inline">canonical scenario · GitHub PR Review skill</span>
        </div>

        <div className="border border-ink bg-paper">
          <div className="grid grid-cols-12 border-b border-ink">
            <div className="col-span-12 md:col-span-3 p-5 border-r-0 md:border-r border-ink bg-paper-raised">
              <div className="caption">ACTORS</div>
              <ul className="mt-3 space-y-3 font-mono text-[12px]">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-ink/70">ALICE</span>
                  <Chip tone="ink">AUTHOR</Chip>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-ink/70">BOB</span>
                  <Chip tone="accent">CONTRIBUTOR</Chip>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-ink/70">CAROL</span>
                  <Chip tone="muted">SUBSCRIBER</Chip>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-ink/70">JUDGE</span>
                  <Chip tone="ghost">SERVICE</Chip>
                </li>
              </ul>
              <div className="mt-5 caption">SUBJECT</div>
              <p className="mt-2 font-mono text-[12px] text-ink/80 leading-[1.4]">
                A &ldquo;PR review&rdquo; skill priced at <span className="font-display text-accent">0.1 SOL</span>/mo.
                Author floor = 40%.
              </p>
            </div>
            <div className="col-span-12 md:col-span-9 p-5">
              <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                {LOOP_STEPS.map((step, i) => (
                  <li key={i} className="flex gap-4">
                    <div className="shrink-0 font-display text-2xl text-accent leading-none w-8">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="flex-1">
                      <div className="font-display text-sm uppercase tracking-[0.08em]">{step.title}</div>
                      <p className="mt-1 font-mono text-[11px] leading-[1.5] text-ink/80">{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            <span>OUTCOME · ALICE 100% → 72.5% · BOB 0% → 27.5% · CAROL stays 0% (paid, did not contribute)</span>
            <span>RUNTIME · ~3 min on stage</span>
          </div>
        </div>
      </section>

      {/* ───────────────── ARCHITECTURE & WHO ───────────────── */}
      <section className="col-span-12 pt-14 grid grid-cols-12 gap-6">
        <div className="col-span-12 flex items-baseline justify-between mb-1">
          <div className="flex items-baseline gap-3">
            <span className="caption">§ 03</span>
            <h2 className="font-display text-2xl uppercase tracking-[0.04em]">System surfaces</h2>
          </div>
          <span className="caption hidden md:inline">five programs · one judge · zero SDK</span>
        </div>

        {/* Programs grid */}
        <LabeledBox title="ON-CHAIN" code="anchor / 5 programs" className="col-span-12 md:col-span-7">
          <ul className="font-mono text-[11px] divide-y divide-ink/15">
            {PROGRAMS.map((p) => (
              <li key={p.name} className="grid grid-cols-12 gap-3 py-2 first:pt-0 last:pb-0">
                <span className="col-span-4 font-display uppercase tracking-[0.06em]">{p.name}</span>
                <span className="col-span-7 text-ink/75 leading-[1.5]">{p.desc}</span>
                <span className="col-span-1 text-right text-muted">{p.tag}</span>
              </li>
            ))}
          </ul>
        </LabeledBox>

        {/* Off-chain stack */}
        <LabeledBox title="OFF-CHAIN" code="services / clients" className="col-span-12 md:col-span-5" tone="raised">
          <ul className="font-mono text-[11px] space-y-3">
            {OFFCHAIN.map((p) => (
              <li key={p.name} className="flex items-baseline gap-3">
                <span className="font-display uppercase tracking-[0.06em] w-28 shrink-0">{p.name}</span>
                <span className="text-ink/75 leading-[1.5]">{p.desc}</span>
              </li>
            ))}
          </ul>
        </LabeledBox>

        {/* Audience cards */}
        <div className="col-span-12 grid grid-cols-12 gap-6 mt-2">
          {AUDIENCES.map((a, i) => (
            <div
              key={a.who}
              className="col-span-12 md:col-span-4 border border-ink bg-paper relative corner-box"
            >
              <div className="px-5 py-4 border-b border-ink flex items-center justify-between">
                <div className="font-display uppercase tracking-[0.08em] text-sm">{a.who}</div>
                <span className="font-mono text-[10px] text-muted">/ ROLE 0{i + 1}</span>
              </div>
              <div className="px-5 py-4">
                <p className="font-serif text-base leading-[1.4]">{a.pitch}</p>
                <Link
                  href={a.href}
                  className="accent-underline mt-4 inline-block font-mono text-[11px] uppercase tracking-[0.2em]"
                >
                  {a.cta} →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── ROADMAP ───────────────── */}
      <section className="col-span-12 pt-14">
        <div className="flex items-baseline justify-between mb-6">
          <div className="flex items-baseline gap-3">
            <span className="caption">§ 04</span>
            <h2 className="font-display text-2xl uppercase tracking-[0.04em]">Roadmap</h2>
          </div>
          <span className="caption hidden md:inline">MVP shipped · four phases ahead</span>
        </div>

        <div className="grid grid-cols-12 gap-0 border border-ink bg-paper">
          {ROADMAP.map((phase, pi) => (
            <div
              key={phase.id}
              className={
                "col-span-12 md:col-span-3 p-5 " +
                (pi < ROADMAP.length - 1 ? "border-b md:border-b-0 md:border-r border-ink " : "") +
                (pi % 2 === 1 ? "bg-paper-raised" : "")
              }
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-3xl text-accent leading-none">{phase.id}</span>
                <span
                  className={
                    "font-mono text-[10px] uppercase tracking-[0.16em] border px-2 py-[2px] " +
                    (phase.priority === "P0"
                      ? "bg-accent text-ink border-ink"
                      : phase.priority === "P1"
                      ? "bg-ink text-paper border-ink"
                      : "bg-paper text-ink border-ink")
                  }
                >
                  {phase.priority}
                </span>
              </div>
              <div className="mt-4 font-display uppercase tracking-[0.04em] text-base leading-tight">
                {phase.title}
              </div>
              <p className="mt-2 font-serif text-sm leading-[1.4] text-ink/80">
                {phase.summary}
              </p>
              <ul className="mt-4 space-y-1.5 font-mono text-[11px] text-ink/85">
                {phase.items.map((it) => (
                  <li key={it} className="flex gap-2 leading-[1.4]">
                    <span className="text-accent shrink-0">→</span>
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ───────────────── PITCH NARRATIVE ───────────────── */}
      <section className="col-span-12 pt-14">
        <div className="flex items-baseline justify-between mb-6">
          <div className="flex items-baseline gap-3">
            <span className="caption">§ 05</span>
            <h2 className="font-display text-2xl uppercase tracking-[0.04em]">Why it matters</h2>
          </div>
          <span className="caption hidden md:inline">four lines we will be repeating</span>
        </div>

        <ol className="border-x border-t border-ink bg-paper">
          {PITCH.map((line, i) => (
            <li
              key={i}
              className="grid grid-cols-12 border-b border-ink"
            >
              <div className="col-span-2 md:col-span-1 border-r border-ink px-3 py-5 flex items-start justify-center">
                <span className="font-display text-3xl text-accent leading-none">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="col-span-10 md:col-span-11 px-5 py-5">
                <div className="font-display uppercase tracking-[0.06em] text-lg leading-tight">
                  {line.headline}
                </div>
                <p className="mt-2 font-serif text-base leading-[1.45] max-w-3xl">
                  {line.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────────────── CTA STRIP ───────────────── */}
      <section className="col-span-12 mt-12 border border-ink bg-ink text-paper">
        <div className="grid grid-cols-12 gap-0">
          <div className="col-span-12 md:col-span-8 p-8 md:border-r border-paper/15">
            <div className="caption text-paper/60">// END OF SPEC</div>
            <h2 className="font-display text-display-2 uppercase tracking-[-0.01em] mt-2 leading-[1]">
              Three minutes to publish.<br />
              <span className="text-accent">Forever to compound.</span>
            </h2>
            <p className="font-serif text-lg mt-4 max-w-xl text-paper/85 leading-[1.4]">
              Deploy a skill, install the Reflection Skill in your agent host, or open the live console
              and watch a complete loop close on Devnet.
            </p>
          </div>
          <div className="col-span-12 md:col-span-4 p-8 flex flex-col gap-3 justify-center bg-ink-soft">
            <Link href="/publish"><Btn variant="primary" className="w-full justify-center">Publish a skill</Btn></Link>
            <Link href="/reflection-skill">
              <Btn variant="ghost" className="w-full justify-center bg-transparent text-paper border-paper hover:bg-paper hover:text-ink">
                Install Reflection Skill
              </Btn>
            </Link>
            <Link href="/console">
              <Btn variant="ghost" className="w-full justify-center bg-transparent text-paper border-paper hover:bg-paper hover:text-ink">
                Open live console
              </Btn>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

const SPEC_STRIP = [
  { label: "CHAIN", value: "Solana", hint: "Anchor · Devnet" },
  { label: "PROGRAMS", value: "5 / 5", hint: "Registry · Sub · Shares · Exp · Pool" },
  { label: "STORAGE", value: "Irys → Arweave", hint: "< 100KB free · permanent" },
  { label: "JUDGE", value: "claude-opus-4-7", hint: "single judge · MVP" },
];

const BEATS = [
  {
    title: "OPT IN AT ZERO",
    body: "Every subscriber gets a share account with 0 shares at purchase. If they never contribute, they stay at 0 — it's just a subscription. If they contribute useful experience, their shares grow.",
  },
  {
    title: "MINT, DON'T TRANSFER",
    body: "Shares are minted, never transferred. The author is never involuntarily diluted below a floor they set. Contributors grow the pie instead of taking from the author.",
  },
  {
    title: "AI-SETTLED",
    body: "AI judges evaluate AI contributions to AI skills. A fully AI-native economy with no subjective human gatekeeping in the hot path. Every score report is permanently auditable.",
  },
  {
    title: "THE CLIENT IS A SKILL",
    body: "Instead of shipping an SDK, the protocol's reflection logic is itself a SKILL.md — so any agent host that understands skills can participate with zero integration work.",
  },
];

const LOOP_STEPS = [
  {
    title: "Publish",
    body: "Alice uploads SKILL.md, sets price 0.1 SOL/mo and a 40% author floor. Lit Protocol gates the file; Irys writes it to Arweave.",
  },
  {
    title: "Subscribe",
    body: "Bob subscribes. A ShareAccount opens at 0 shares. He is on the cap table from second one — without paying for equity.",
  },
  {
    title: "Use & fail",
    body: "Bob's agent reviews a Rust PR with `unsafe` blocks. Alice's checklist is language-agnostic; the review misses the safety implications entirely.",
  },
  {
    title: "Reflect",
    body: "The Reflection Skill fires. It produces a structured ExperienceBundle: trace, root cause, merge-ready patch, test case.",
  },
  {
    title: "Submit",
    body: "Bob pastes the JSON into /submit. Two Phantom prompts — Irys, then Solana. ExperienceRecord lands on-chain as Pending.",
  },
  {
    title: "Judge",
    body: "Within ~30s, the AI Judge fetches the bundle, scores 5 dimensions, signs the report and writes it to Arweave for audit.",
  },
  {
    title: "Mint shares",
    body: "Score 38/50 → 380 shares minted to Bob, capped so Alice never falls below her 40% floor. The pie animates, not the wallets.",
  },
  {
    title: "Distribute & evolve",
    body: "When Carol subscribes the next day, the pool settles and pays Alice + Bob proportionally. Carol earns 0 — she didn't contribute. Alice merges Bob's patch as v1.1.",
  },
];

const PROGRAMS = [
  { name: "SkillRegistry", desc: "Skill metadata, current version, content hash, Arweave tx id, price.", tag: "1/5" },
  { name: "Subscription", desc: "30-day usage rights for a wallet on a specific skill.", tag: "2/5" },
  { name: "ShareLedger", desc: "Per-skill cap table. Tracks total shares, author shares, contributor count, floor (in bps).", tag: "3/5" },
  { name: "Experience", desc: "Buyer contributions, judge scores, share-mint hooks, status machine.", tag: "4/5" },
  { name: "RevenuePool", desc: "Subscription accumulator. Snapshots and settlements per period.", tag: "5/5" },
];

const OFFCHAIN = [
  { name: "Reflection Skill", desc: "SKILL.md the agent loads. Does the thinking — root cause, patch, test, JSON." },
  { name: "AI Judge", desc: "Node service. Watches events, fetches Arweave, calls Claude, signs and writes report." },
  { name: "Irys", desc: "Solana-native L2 over Arweave. Phantom signs. Files < 100 KB are free, permanent." },
  { name: "Lit Protocol", desc: "Subscriber-gated decryption keys. Only active subs receive plaintext skill content." },
  { name: "Web app", desc: "Next.js. Wallet, /submit signing flow, market, dashboard, demo console." },
];

const AUDIENCES = [
  {
    who: "SKILL AUTHORS",
    pitch:
      "Publish once. Set your floor. Watch contributors widen your skill's coverage while your absolute share count never drops.",
    cta: "Publish a skill",
    href: "/publish",
  },
  {
    who: "AGENT OPERATORS",
    pitch:
      "Subscribe to skills your agent already needs. Turn every failure into shares — the more it fails, the more you earn from fixing it.",
    cta: "Browse the market",
    href: "/market",
  },
  {
    who: "AGENT HOSTS",
    pitch:
      "No SDK to integrate. Drop the Reflection Skill into Claude Desktop or Cursor and your users are already plugged into the protocol.",
    cta: "Get the Reflection Skill",
    href: "/reflection-skill",
  },
];

const ROADMAP: {
  id: string;
  title: string;
  summary: string;
  priority: "P0" | "P1" | "P2" | "P3";
  items: string[];
}[] = [
  {
    id: "01",
    title: "Decentralize Trust",
    summary: "Remove the single-Judge assumption and close the meta loop.",
    priority: "P0",
    items: [
      "Multi-judge voting w/ stake & slash",
      "Judge DAO + governance token",
      "Regression test engine",
      "Reflection Skill self-hosted on SLP",
    ],
  },
  {
    id: "02",
    title: "Deepen the Economy",
    summary: "Rich incentives for authors, contributors, and Judges.",
    priority: "P1",
    items: [
      "Kleros-style arbitration",
      "Secondary market for post-lock shares",
      "Native Phantom deep-link signing",
      "Agent-to-agent economic layer",
    ],
  },
  {
    id: "03",
    title: "Harden & Scale",
    summary: "Fix MVP limits, raise the throughput ceiling.",
    priority: "P2",
    items: [
      "zkVM regression proofs",
      "One-click merge for high-scoring patches",
      "Cross-skill experience transfer",
      "Merkle-based revenue distribution",
    ],
  },
  {
    id: "04",
    title: "Expand the Ecosystem",
    summary: "From product to infrastructure for the agent economy.",
    priority: "P3",
    items: [
      "Fork mechanism w/ original-author royalty",
      "Skill-as-IP on-chain licensing",
      "Cross-chain skill market (Wormhole/LayerZero)",
      "Universal Skill Standard",
    ],
  },
];

const PITCH = [
  {
    headline: "Every buyer is a potential shareholder.",
    body: "The default is zero shares. You buy, you're on the cap table, you decide whether to earn equity. This reframes the entire relationship between skill authors and skill users.",
  },
  {
    headline: "Skills that get better the more they fail.",
    body: "Failure is the most valuable training signal. Skill Loops is the first protocol that turns it into an asset class — buyers stop being end users and become the upstream of the next version.",
  },
  {
    headline: "A fully AI-native economy.",
    body: "AI skills, AI agents, AI judges. No human gatekeeper in the hot path. Not AI-assisted commerce — AI-settled. This is what agent-to-agent commerce will look like.",
  },
  {
    headline: "The first skill teaches every other skill how to evolve.",
    body: "The Reflection Skill is both our client and a living demonstration. It will eventually evolve on SLP itself, making it the most literal self-bootstrapping system in the agent economy.",
  },
];
