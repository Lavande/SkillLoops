import { getDb } from "@/lib/db";
import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";

// Slice 1's `seedDemoIfEmpty` published mock skills directly into SQLite via
// `lib/services.publishSkill`. Slice 3 makes the chain authoritative — seeding
// now happens via `scripts/seed-devnet.ts`, which signs real `publishSkill`
// transactions on devnet. The indexer projects them into SQLite. This shim is
// kept only so existing /api/seed callers don't 404.
export const DEMO_PERSONAS = {
  alice: demoPubkey("persona:alice"),
  bob: demoPubkey("persona:bob"),
  carol: demoPubkey("persona:carol"),
  other1: demoPubkey("persona:other1"),
  other2: demoPubkey("persona:other2"),
};

export interface SeedReport {
  seeded: boolean;
  skills: number;
  personas: typeof DEMO_PERSONAS;
  aliceSkillId: string | null;
}

type Env = Record<string, string | undefined>;

const DEMO_SKILLS = [
  {
    owner: "alice",
    name: "GitHub PR Review",
    description: "Reviews PRs for tests, style, security, and safety regressions.",
    category: "code-review",
    content: "# GitHub PR Review\n\nReview changed files for correctness, tests, security, and actionable merge feedback.\n",
    price: 100_000_000,
    floor: 4000,
    subscribers: 2,
  },
  {
    owner: "other1",
    name: "Incident Runbook Triage",
    description: "Turns noisy production alerts into a ranked incident checklist.",
    category: "ops",
    content: "# Incident Runbook Triage\n\nClassify alerts, identify likely blast radius, and propose the next diagnostic step.\n",
    price: 50_000_000,
    floor: 4500,
    subscribers: 1,
  },
  {
    owner: "other2",
    name: "Schema Migration Reviewer",
    description: "Checks database migrations for locks, backfills, and rollback hazards.",
    category: "database",
    content: "# Schema Migration Reviewer\n\nAnalyze DDL and data migrations for operational risk before they ship.\n",
    price: 75_000_000,
    floor: 5000,
    subscribers: 0,
  },
] as const;

export function seedDemoIfEmpty(env: Env = process.env, dbPath?: string): SeedReport {
  const db = dbPath ? getDb(dbPath) : getDb();
  const count = (db.prepare(`SELECT COUNT(*) AS n FROM skills`).get() as any).n as number;
  if (count === 0 && shouldSeedLocalMock(env)) seedLocalMockDemo(dbPath);

  const nextCount = (db.prepare(`SELECT COUNT(*) AS n FROM skills`).get() as any).n as number;
  const alice = db
    .prepare(`SELECT skill_id FROM skills WHERE name = 'GitHub PR Review' LIMIT 1`)
    .get() as any;
  return {
    seeded: count === 0 && nextCount > 0,
    skills: nextCount,
    personas: DEMO_PERSONAS,
    aliceSkillId: alice?.skill_id ?? null,
  };
}

function shouldSeedLocalMock(env: Env) {
  return (
    env.STORAGE_BACKEND !== "irys" &&
    env.JUDGE_BACKEND !== "anthropic" &&
    env.NEXT_PUBLIC_STORAGE_MODE !== "browser-irys" &&
    env.NEXT_PUBLIC_LIT_MODE !== "real"
  );
}

function seedLocalMockDemo(dbPath?: string) {
  const db = dbPath ? getDb(dbPath) : getDb();
  const now = Math.floor(Date.now() / 1000);
  const insert = db.transaction(() => {
    for (const skill of DEMO_SKILLS) {
      const skillId = demoPubkey(`skill:${skill.name}`);
      const author = DEMO_PERSONAS[skill.owner];
      const contentHash = sha256Hex(skill.content);
      const arweaveTxId = `ar_${sha256Hex(`${skillId}:v1`).slice(0, 32)}`;

      db.prepare(
        `INSERT INTO arweave_objects (tx_id, content, tags, owner, uploaded_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(
        arweaveTxId,
        skill.content,
        JSON.stringify([
          { name: "Protocol", value: "SLP" },
          { name: "Type", value: "SkillContent" },
          { name: "Name", value: skill.name },
          { name: "Encrypted", value: "false" },
        ]),
        author,
        now,
      );

      db.prepare(
        `INSERT INTO skills (
          skill_id, author, name, description, category, current_version, content_hash,
          arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at,
          subscriber_count, total_revenue
        ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, 0)`
      ).run(
        skillId,
        author,
        skill.name,
        skill.description,
        skill.category,
        contentHash,
        arweaveTxId,
        skill.price,
        skill.floor,
        now,
        now,
        skill.subscribers,
      );

      db.prepare(
        `INSERT INTO skill_versions (
          skill_id, version, content_hash, arweave_tx_id, contributing_experience_ids, published_at
        ) VALUES (?, 1, ?, ?, '[]', ?)`
      ).run(skillId, contentHash, arweaveTxId, now);

      db.prepare(
        `INSERT INTO share_ledgers (
          skill_id, author_ownership_bps, contributor_pool_bps, min_author_ratio_bps,
          total_contributor_weight, contributor_count, points_per_100bps,
          max_pool_increase_per_evaluation_bps, last_snapshot_time
        ) VALUES (?, 10000, 0, ?, 0, 0, 250, 500, ?)`
      ).run(skillId, skill.floor, now);

      db.prepare(
        `INSERT INTO share_accounts (
          holder, skill_id, contribution_weight, lock_until, first_contribution_at, last_contribution_at
        ) VALUES (?, ?, 0, 0, NULL, NULL)`
      ).run(author, skillId);

      db.prepare(
        `INSERT INTO revenue_pools (
          skill_id, current_period_revenue, total_lifetime_revenue, current_period_start,
          period_length, snapshot_author_ownership_bps, snapshot_contributor_pool_bps, last_settlement_time
        ) VALUES (?, ?, 0, ?, 300, 10000, 0, 0)`
      ).run(skillId, skill.price * skill.subscribers, now);
    }
  });
  insert();
}

function demoPubkey(seed: string) {
  return new PublicKey(crypto.createHash("sha256").update(seed).digest()).toBase58();
}

function sha256Hex(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
