import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db";
import { publishSkill, getPeriodLengthSeconds, SOL } from "@/lib/services";
import { solToLamports } from "@/lib/units";

export const DEMO_PERSONAS = {
  alice: "AliceAuthorDemoDAP1111111111111111111111",
  bob: "BobAgentOperatorDemoDAP111111111111111111",
  carol: "CarolAgentOperatorDemoDAP1111111111111111",
  other1: "D4V1DSk111AuthorDemoDAP11111111111111111",
  other2: "ElOth3rDesignerDemoDAP11111111111111111",
};

export interface SeedReport {
  seeded: boolean;
  skills: number;
  personas: typeof DEMO_PERSONAS;
  aliceSkillId: string | null;
}

export function seedDemoIfEmpty(): SeedReport {
  const db = getDb();
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM skills`).get() as any).n as number;
  if (count > 0) {
    const alice = db
      .prepare(`SELECT skill_id FROM skills WHERE author = ? AND name = 'GitHub PR Review'`)
      .get(DEMO_PERSONAS.alice) as any;
    return { seeded: false, skills: count, personas: DEMO_PERSONAS, aliceSkillId: alice?.skill_id ?? null };
  }
  const periodLen = getPeriodLengthSeconds();

  // Main demo skill — Alice's PR review skill.
  const aliceContent = readReflectionSafe() || DEFAULT_PR_REVIEW_SKILL;
  const alice = publishSkill({
    author: DEMO_PERSONAS.alice,
    name: "GitHub PR Review",
    description: "Walks an agent through reviewing a PR: missing tests, security smells, style, structured review comment.",
    category: "code-review",
    content: aliceContent,
    subscriptionPriceLamports: solToLamports(0.1),
    minAuthorRatioBps: 4000,
    periodLengthSeconds: periodLen,
  });

  // A handful of other market skills for atmosphere.
  const market: Array<Parameters<typeof publishSkill>[0]> = [
    {
      author: DEMO_PERSONAS.other1,
      name: "Incident Post-mortem Drafter",
      description: "Turns raw incident chatter into a structured post-mortem with action items.",
      category: "ops",
      content: "# Post-mortem skill v1\n\n1. Collect incident timeline.\n2. Identify root cause.\n3. Draft action items.",
      subscriptionPriceLamports: solToLamports(0.05),
      minAuthorRatioBps: 4500,
      periodLengthSeconds: periodLen,
    },
    {
      author: DEMO_PERSONAS.other2,
      name: "SQL Query Reviewer",
      description: "Reads a SQL query and explains performance risks, index hints, and likely mistakes.",
      category: "database",
      content: "# SQL review skill v1\n\n1. Parse the query.\n2. Flag N+1 / missing index.\n3. Suggest rewrites.",
      subscriptionPriceLamports: solToLamports(0.08),
      minAuthorRatioBps: 3500,
      periodLengthSeconds: periodLen,
    },
    {
      author: DEMO_PERSONAS.other1,
      name: "Changelog Copywriter",
      description: "Turns a list of commits into human-readable release notes, grouped by theme.",
      category: "docs",
      content: "# Changelog skill v1",
      subscriptionPriceLamports: solToLamports(0.03),
      minAuthorRatioBps: 5000,
      periodLengthSeconds: periodLen,
    },
    {
      author: DEMO_PERSONAS.other2,
      name: "Kubernetes Manifest Auditor",
      description: "Reviews Kubernetes manifests for misconfig, pod-level security, and resource limits.",
      category: "ops",
      content: "# K8s manifest audit skill v1",
      subscriptionPriceLamports: solToLamports(0.15),
      minAuthorRatioBps: 4000,
      periodLengthSeconds: periodLen,
    },
    {
      author: DEMO_PERSONAS.other1,
      name: "API Spec Linter",
      description: "Lints an OpenAPI spec for inconsistencies, naming, and missing error responses.",
      category: "api",
      content: "# OpenAPI lint skill v1",
      subscriptionPriceLamports: solToLamports(0.04),
      minAuthorRatioBps: 3500,
      periodLengthSeconds: periodLen,
    },
    {
      author: DEMO_PERSONAS.other2,
      name: "Dockerfile Hardening Checklist",
      description: "Walks an agent through common Dockerfile security and efficiency issues.",
      category: "ops",
      content: "# Dockerfile hardening skill v1",
      subscriptionPriceLamports: solToLamports(0.06),
      minAuthorRatioBps: 4000,
      periodLengthSeconds: periodLen,
    },
  ];
  for (const s of market) publishSkill(s);

  return {
    seeded: true,
    skills: 1 + market.length,
    personas: DEMO_PERSONAS,
    aliceSkillId: alice.skillId,
  };
}

function readReflectionSafe(): string | null {
  try {
    const p = path.join(process.cwd(), "public", "github-pr-review.SKILL.md");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8");
  } catch {}
  return null;
}

const DEFAULT_PR_REVIEW_SKILL = `# GitHub PR Review Skill v1.0

## Purpose
Given a pull request, produce a structured review comment covering:
- missing tests
- security smells
- stylistic issues

## Steps
1. Detect primary language.
2. Scan for common smells (unused code, wide error handling, etc.).
3. Produce a structured review comment with three sections: Tests, Security, Style.

## Output format
- bulleted markdown review
- one summary sentence at the bottom
`;
