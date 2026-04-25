import { getDb } from "@/lib/db";

// Slice 1's `seedDemoIfEmpty` published mock skills directly into SQLite via
// `lib/services.publishSkill`. Slice 3 makes the chain authoritative — seeding
// now happens via `scripts/seed-devnet.ts`, which signs real `publishSkill`
// transactions on devnet. The indexer projects them into SQLite. This shim is
// kept only so existing /api/seed callers don't 404.
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
  const alice = db
    .prepare(`SELECT skill_id FROM skills WHERE name = 'GitHub PR Review' LIMIT 1`)
    .get() as any;
  return {
    seeded: false,
    skills: count,
    personas: DEMO_PERSONAS,
    aliceSkillId: alice?.skill_id ?? null,
  };
}
