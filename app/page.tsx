import Link from "next/link";
import { SkillLoopMotif } from "@/components/loop/SkillLoopMotif";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";

export default function Home() {
  return (
    <div className="grid grid-cols-12 gap-6">
      <header className="col-span-12 pt-10 pb-8 flex items-end justify-between gap-8 border-b border-ink">
        <div className="max-w-3xl">
          <div className="caption mb-3">PROTOCOL SPEC / HACKATHON MVP</div>
          <h1 className="font-display text-display-1 uppercase tracking-[-0.01em] leading-[0.95]">
            Buying a skill<br />is opting in at<br /><span className="text-accent">zero shares</span>.
          </h1>
          <p className="font-serif text-xl mt-6 leading-[1.3] max-w-xl">
            Every buyer of an AI agent skill is automatically a potential shareholder. Contribute usage
            experience to earn shares. All subscribers share the skill's future revenue.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Link href="/market"><Btn variant="primary">Enter market</Btn></Link>
            <Link href="/publish"><Btn variant="ghost">Publish a skill</Btn></Link>
            <Link href="/reflection-skill"><Btn variant="ink">Get Reflection Skill</Btn></Link>
          </div>
        </div>
        <div className="hidden md:block">
          <SkillLoopMotif size={320} />
        </div>
      </header>

      <section className="col-span-12 grid grid-cols-12 gap-6 py-10">
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

      <section className="col-span-12 border border-ink bp-grid">
        <div className="grid grid-cols-12 gap-0 items-stretch">
          <div className="col-span-12 md:col-span-5 p-8 border-b md:border-b-0 md:border-r border-ink bg-paper">
            <div className="caption">SPEC / CENTERPIECE</div>
            <h2 className="font-display text-display-2 mt-2 uppercase leading-[1]">A fully AI-native economy.</h2>
            <p className="font-serif text-lg mt-4 leading-[1.4]">
              AI skills. AI agents. AI judges. No human gatekeeper in the hot path. The client is itself a skill —
              the Reflection Skill — so any agent host that understands skills can participate with zero
              integration work.
            </p>
            <div className="mt-6">
              <Link href="/console" className="accent-underline font-mono text-[11px] uppercase tracking-[0.2em]">
                See the live demo console →
              </Link>
            </div>
          </div>
          <div className="col-span-12 md:col-span-7 bg-paper-raised p-6 flex items-center justify-center">
            <SkillLoopMotif size={420} active="REFLECT" />
          </div>
        </div>
      </section>
    </div>
  );
}

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
