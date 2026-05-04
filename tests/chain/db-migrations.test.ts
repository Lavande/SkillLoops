import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect, beforeEach } from "vitest";
import { closeDb, _resetSingletonForTesting, getDb, resetDb, resolveDbPath } from "@/lib/db";

beforeEach(() => _resetSingletonForTesting());

describe("indexer migrations", () => {
  it("creates indexer_state table", () => {
    const db = getDb(":memory:");
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='indexer_state'`).get();
    expect(row).toBeTruthy();
  });
  it("creates indexed_signatures table with status column", () => {
    const db = getDb(":memory:");
    const cols = db.prepare(`PRAGMA table_info(indexed_signatures)`).all() as any[];
    expect(cols.map((c) => c.name)).toEqual(
      expect.arrayContaining(["signature", "slot", "status", "error_code", "processed_at"])
    );
  });
  it("keys experiences by skill id plus chain experience id", () => {
    const db = getDb(":memory:");
    const pk = (db.prepare(`PRAGMA table_info(experiences)`).all() as any[])
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name);
    expect(pk).toEqual(["skill_id", "experience_id"]);
  });
  it("creates ownership-weight share ledger columns", () => {
    const db = getDb(":memory:");
    const cols = db.prepare(`PRAGMA table_info(share_ledgers)`).all() as any[];
    expect(cols.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "author_ownership_bps",
        "contributor_pool_bps",
        "total_contributor_weight",
        "points_per_100bps",
        "max_pool_increase_per_evaluation_bps",
      ])
    );
  });

  it("upgrades old share-column databases to ownership-weight columns", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "slp-old-db-"));
    const dbPath = path.join(dir, "old.sqlite");
    const oldDb = new Database(dbPath);
    oldDb.exec(`
      CREATE TABLE skills (
        skill_id TEXT PRIMARY KEY,
        author TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        current_version INTEGER NOT NULL DEFAULT 1,
        content_hash TEXT NOT NULL,
        arweave_tx_id TEXT NOT NULL,
        subscription_price INTEGER NOT NULL,
        min_author_ratio_bps INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        subscriber_count INTEGER NOT NULL DEFAULT 0,
        total_revenue INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE share_ledgers (
        skill_id TEXT PRIMARY KEY,
        total_shares INTEGER NOT NULL,
        author_shares INTEGER NOT NULL,
        min_author_ratio_bps INTEGER NOT NULL,
        contributor_count INTEGER NOT NULL,
        last_snapshot_time INTEGER NOT NULL
      );
      CREATE TABLE share_accounts (
        holder TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        shares INTEGER NOT NULL DEFAULT 0,
        lock_until INTEGER NOT NULL DEFAULT 0,
        first_contribution_at INTEGER,
        last_contribution_at INTEGER,
        PRIMARY KEY (holder, skill_id)
      );
      CREATE TABLE experiences (
        experience_id INTEGER NOT NULL,
        skill_id TEXT NOT NULL,
        contributor TEXT NOT NULL,
        skill_version INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        arweave_tx_id TEXT NOT NULL,
        bundle_json TEXT NOT NULL,
        status TEXT NOT NULL,
        contribution_score INTEGER,
        shares_minted INTEGER,
        submitted_at INTEGER NOT NULL,
        evaluated_at INTEGER,
        judge_report_tx_id TEXT,
        judge_report_json TEXT,
        PRIMARY KEY (skill_id, experience_id)
      );
      INSERT INTO skills (
        skill_id, author, name, description, category, current_version, content_hash,
        arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at
      ) VALUES ('skill-a', 'author-a', 'Skill A', 'desc', 'code-review', 1, 'h', 'ar', 100, 4000, 10, 10);
      INSERT INTO share_ledgers (
        skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time
      ) VALUES ('skill-a', 2500, 1000, 4000, 2, 10);
      INSERT INTO share_accounts (
        holder, skill_id, shares, lock_until
      ) VALUES ('author-a', 'skill-a', 1000, 0), ('contrib-a', 'skill-a', 1500, 20);
      INSERT INTO experiences (
        experience_id, skill_id, contributor, skill_version, content_hash, arweave_tx_id, bundle_json,
        status, contribution_score, shares_minted, submitted_at
      ) VALUES (0, 'skill-a', 'contrib-a', 1, 'h', 'ar-exp', '{}', 'Evaluated', 42, 420, 11);
    `);
    oldDb.close();

    const db = getDb(dbPath);
    const ledgers = db.prepare(`PRAGMA table_info(share_ledgers)`).all() as any[];
    expect(ledgers.map((c) => c.name)).toEqual(
      expect.arrayContaining([
        "author_ownership_bps",
        "contributor_pool_bps",
        "total_contributor_weight",
        "points_per_100bps",
        "max_pool_increase_per_evaluation_bps",
      ])
    );
    const accounts = db.prepare(`PRAGMA table_info(share_accounts)`).all() as any[];
    expect(accounts.map((c) => c.name)).toContain("contribution_weight");
    const experiences = db.prepare(`PRAGMA table_info(experiences)`).all() as any[];
    expect(experiences.map((c) => c.name)).toEqual(
      expect.arrayContaining(["contribution_weight_delta", "ownership_delta_bps"])
    );
    const row = db
      .prepare(
        `SELECT s.skill_id, l.author_ownership_bps, l.contributor_pool_bps, l.total_contributor_weight, a.contribution_weight, e.contribution_weight_delta
         FROM skills s
         JOIN share_ledgers l ON l.skill_id = s.skill_id
         JOIN share_accounts a ON a.skill_id = s.skill_id AND a.holder = 'contrib-a'
         JOIN experiences e ON e.skill_id = s.skill_id AND e.experience_id = 0`
      )
      .get() as any;
    expect(row).toMatchObject({
      skill_id: "skill-a",
      author_ownership_bps: 4000,
      contributor_pool_bps: 6000,
      total_contributor_weight: 1500,
      contribution_weight: 1500,
      contribution_weight_delta: 420,
    });
  });

  it("opens a fresh sqlite file when the program id changes", () => {
    const prevCluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
    const prevProgramId = process.env.NEXT_PUBLIC_SLP_PROGRAM_ID;
    let fileA: string | null = null;
    let fileB: string | null = null;

    const cleanup = (file: string | null) => {
      if (!file) return;
      for (const suffix of ["", "-wal", "-shm"]) {
        const p = `${file}${suffix}`;
        if (fs.existsSync(p)) fs.rmSync(p);
      }
      const dir = path.dirname(file);
      if (
        dir !== path.join(process.cwd(), "data") &&
        fs.existsSync(dir) &&
        fs.readdirSync(dir).length === 0
      ) {
        fs.rmdirSync(dir);
      }
    };

    try {
      process.env.NEXT_PUBLIC_SOLANA_CLUSTER = "devnet";
      process.env.NEXT_PUBLIC_SLP_PROGRAM_ID = "BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t";
      const dbA = getDb();
      dbA.prepare(
        `INSERT INTO skills (
          skill_id, author, name, description, category, current_version, content_hash,
          arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(
        "skill-a",
        "author-a",
        "Old Skill",
        "desc",
        "code-review",
        1,
        "hash",
        "ar_a",
        100,
        4000,
        1,
        1,
      );
      fileA = dbA.name;
      closeDb();

      process.env.NEXT_PUBLIC_SLP_PROGRAM_ID = "5uTb4ZPTVB1HFMdTeBXELPzgaX2dcVRZoxPQW2SNzQAH";
      const dbB = getDb();
      fileB = dbB.name;

      expect(fileB).not.toBe(fileA);
      const row = dbB.prepare(`SELECT COUNT(*) AS n FROM skills`).get() as any;
      expect(row.n).toBe(0);
    } finally {
      closeDb();
      cleanup(fileA);
      cleanup(fileB);
      process.env.NEXT_PUBLIC_SOLANA_CLUSTER = prevCluster;
      process.env.NEXT_PUBLIC_SLP_PROGRAM_ID = prevProgramId;
    }
  });

  it("resetDb removes the current scoped sqlite file", () => {
    const dbPath = resolveDbPath(undefined, {
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SLP_PROGRAM_ID: "BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t",
    });
    const prevCluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER;
    const prevProgramId = process.env.NEXT_PUBLIC_SLP_PROGRAM_ID;
    process.env.NEXT_PUBLIC_SOLANA_CLUSTER = "devnet";
    process.env.NEXT_PUBLIC_SLP_PROGRAM_ID = "BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t";
    try {
      const db = getDb();
      db.prepare(`INSERT INTO skills (
        skill_id, author, name, description, category, current_version, content_hash,
        arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run("skill-reset", "author", "Reset Skill", "desc", "code-review", 1, "hash", "ar", 1, 1, 1, 1);
      closeDb();
      expect(fs.existsSync(dbPath)).toBe(true);
      resetDb();
      expect(fs.existsSync(dbPath)).toBe(false);
    } finally {
      closeDb();
      process.env.NEXT_PUBLIC_SOLANA_CLUSTER = prevCluster;
      process.env.NEXT_PUBLIC_SLP_PROGRAM_ID = prevProgramId;
    }
  });
});
