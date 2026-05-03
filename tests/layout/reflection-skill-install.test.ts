import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Reflection Skill install page", () => {
  it("leads with the skills.sh one-line installer", () => {
    const src = read("app/reflection-skill/page.tsx");

    expect(src).toContain("npx skills add Lavande/SkillLoops");
    expect(src).toContain("skills.sh");
    expect(src).toContain("Codex, Cursor, Claude Code, OpenCode");
    expect(src).not.toContain("HOW TO LOAD — CLAUDE DESKTOP");
    expect(src).not.toContain("HOW TO LOAD — CURSOR");
    expect(src).not.toContain("HOW TO LOAD — ANY AGENT");
  });
});
