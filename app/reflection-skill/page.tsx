"use client";

import { useState } from "react";
import { SkillLoopMotif } from "@/components/loop/SkillLoopMotif";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";

export default function ReflectionSkillPage() {
  const [copied, setCopied] = useState<string | null>(null);
  function copy(id: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 1200);
  }

  return (
    <div className="grid grid-cols-12 gap-6 pt-6">
      <header className="col-span-12 grid grid-cols-12 gap-6 items-end pb-4 border-b border-ink">
        <div className="col-span-12 lg:col-span-8">
          <div className="caption mb-2">PROTOCOL / CLIENT</div>
          <h1 className="font-display text-display-1 uppercase leading-[0.95]">
            The first skill on SLP is<br />the <span className="text-accent">Reflection Skill</span>.
          </h1>
          <p className="font-serif text-xl mt-5 max-w-2xl leading-[1.3]">
            Instead of an SDK, the protocol ships its client as a skill. Any agent host that
            understands skills can participate — zero integration work.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <a href="/api/reflection-skill/download" download>
              <Btn variant="primary">Download SKILL.md</Btn>
            </a>
            <a href="/api/reflection-skill/download" target="_blank" rel="noreferrer">
              <Btn variant="ghost">Read source</Btn>
            </a>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 flex items-center justify-center">
          <SkillLoopMotif size={260} active="REFLECT" />
        </div>
      </header>

      <LabeledBox title="HOW TO LOAD — CLAUDE DESKTOP" code="§ setup" className="col-span-12 md:col-span-6 xl:col-span-4">
        <CodeBlock
          id="cd"
          copied={copied}
          copy={copy}
          code={`# one-time, per-project
mkdir -p ~/.claude/skills/slp-reflection
curl -L https://skillloops.xyz/api/reflection-skill/download \\
  -o ~/.claude/skills/slp-reflection/SKILL.md

# restart Claude Desktop; the skill will auto-load.`}
        />
      </LabeledBox>

      <LabeledBox title="HOW TO LOAD — CURSOR" code="§ setup" className="col-span-12 md:col-span-6 xl:col-span-4">
        <CodeBlock
          id="cursor"
          copied={copied}
          copy={copy}
          code={`# save SKILL.md under your workspace
mkdir -p .cursor/skills
curl -L https://skillloops.xyz/api/reflection-skill/download \\
  -o .cursor/skills/slp-reflection.SKILL.md`}
        />
      </LabeledBox>

      <LabeledBox title="HOW TO LOAD — ANY AGENT" code="§ setup" className="col-span-12 md:col-span-6 xl:col-span-4">
        <CodeBlock
          id="any"
          copied={copied}
          copy={copy}
          code={`# any skill-aware agent: drop the file into your
# skills directory and re-index.
curl -L https://skillloops.xyz/api/reflection-skill/download \\
  -o ./skills/slp-reflection.SKILL.md`}
        />
      </LabeledBox>

      <LabeledBox title="WHY THIS MATTERS" code="§ note" className="col-span-12">
        <p className="font-serif text-lg max-w-3xl leading-[1.35]">
          Most agent frameworks include some notion of self-reflection, but outputs are usually
          unstructured prose no one can reuse. The Reflection Skill is specifically designed to produce
          <span className="text-accent"> merge-ready, test-case-backed, schema-valid </span>
          artifacts — a format any human or agent downstream can consume.
        </p>
      </LabeledBox>
    </div>
  );
}

function CodeBlock({ id, copied, copy, code }: { id: string; copied: string | null; copy: (id: string, text: string) => void; code: string }) {
  return (
    <div className="relative">
      <button
        className="absolute top-2 right-2 caption hover:text-accent"
        onClick={() => copy(id, code)}
      >
        {copied === id ? "copied ✓" : "copy"}
      </button>
      <pre className="font-mono text-xs whitespace-pre-wrap leading-[1.5] bg-paper-raised border border-ink/30 p-3 pr-16">{code}</pre>
    </div>
  );
}
