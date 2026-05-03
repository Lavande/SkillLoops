"use client";

import { useState } from "react";
import { SkillLoopMotif } from "@/components/loop/SkillLoopMotif";
import { LabeledBox } from "@/components/brutalist/LabeledBox";
import { Btn } from "@/components/brutalist/Btn";

const SKILL_SOURCE =
  "https://github.com/Lavande/SkillLoops/tree/main/public/reflection-skill";
const INSTALL_COMMAND = "npx skills add Lavande/SkillLoops";
const GLOBAL_INSTALL_COMMAND = "npx skills add Lavande/SkillLoops -g";
const AGENT_INSTALL_COMMAND =
  "npx skills add Lavande/SkillLoops -a codex -a cursor -a claude-code";

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
            Install it through the skills.sh CLI for Codex, Cursor, Claude Code, OpenCode,
            and other skill-aware agents. One command, no custom SLP installer.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Btn variant="primary" onClick={() => copy("hero-install", INSTALL_COMMAND)}>
              {copied === "hero-install" ? "Copied install command" : "Copy npx install"}
            </Btn>
            <a
              href={SKILL_SOURCE}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 border border-ink bg-paper px-4 py-2 text-center font-mono text-[11px] uppercase leading-tight tracking-[0.16em] text-ink transition-colors hover:bg-ink hover:text-paper sm:min-h-0 sm:tracking-[0.18em]"
            >
              Read source
            </a>
          </div>
        </div>
        <div className="col-span-12 lg:col-span-4 flex items-center justify-center">
          <SkillLoopMotif size={260} active="REFLECT" />
        </div>
      </header>

      <LabeledBox title="UNIVERSAL INSTALL" code="§ skills.sh" className="col-span-12 lg:col-span-8">
        <p className="font-serif text-lg leading-[1.35] max-w-3xl mb-4">
          The Reflection Skill is distributed as a normal repository skill. The skills.sh CLI detects
          your agent setup and installs the skill into the right skill directory.
        </p>
        <CodeBlock
          id="install"
          copied={copied}
          copy={copy}
          code={INSTALL_COMMAND}
        />
        <div className="mt-4 grid gap-3 border border-ink/30 bg-paper-raised p-3 font-mono text-[11px] leading-5 sm:grid-cols-3">
          <div>
            <div className="caption mb-1">source</div>
            <div className="break-all">Lavande/SkillLoops</div>
          </div>
          <div>
            <div className="caption mb-1">agents</div>
            <div>Codex, Cursor, Claude Code, OpenCode, and more</div>
          </div>
          <div>
            <div className="caption mb-1">scope</div>
            <div>Project by default; add <span className="text-accent">-g</span> for global</div>
          </div>
        </div>
      </LabeledBox>

      <LabeledBox title="COMMON OPTIONS" code="§ CLI" className="col-span-12 lg:col-span-4">
        <CodeBlock
          id="global"
          copied={copied}
          copy={copy}
          code={`# install globally
${GLOBAL_INSTALL_COMMAND}

# install to specific agents
${AGENT_INSTALL_COMMAND}`}
        />
        <p className="mt-4 font-mono text-[11px] leading-5 text-ink/75">
          Use <span className="text-accent">-a codex</span>, <span className="text-accent">-a cursor</span>,
          or <span className="text-accent">-a claude-code</span> when you want to pin the target agent.
        </p>
      </LabeledBox>

      <LabeledBox title="MANUAL FALLBACK" code="§ no-npm" className="col-span-12 md:col-span-6">
        <CodeBlock
          id="manual"
          copied={copied}
          copy={copy}
          code={`# when npm/npx is blocked, download the raw skill file
mkdir -p ./skills/slp-reflection
curl -L https://skillloops.xyz/api/reflection-skill/download \\
  -o ./skills/slp-reflection/SKILL.md`}
        />
      </LabeledBox>

      <LabeledBox title="WHY THIS MATTERS" code="§ note" className="col-span-12 md:col-span-6">
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
      <pre className="overflow-x-auto whitespace-pre-wrap break-words border border-ink/30 bg-paper-raised p-3 pr-16 font-mono text-xs leading-[1.5]">{code}</pre>
    </div>
  );
}
