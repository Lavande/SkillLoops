import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { _resetSingletonForTesting, closeDb, getDb } from "@/lib/db";

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
  it("backfills share ledger author floors from skills", () => {
    const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "slp-migration-")), "slp.sqlite");
    let db = getDb(dbPath);
    db.prepare(`INSERT INTO skills (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run("skill-a", "author", "Skill", "desc", "cat", 1, "hash", "ar", 100, 4000, 1, 1);
    db.prepare(`INSERT INTO share_ledgers (skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time) VALUES (?,1000,1000,0,0,1)`)
      .run("skill-a");
    closeDb();

    db = getDb(dbPath);

    const ledger = db.prepare(`SELECT min_author_ratio_bps FROM share_ledgers WHERE skill_id = ?`).get("skill-a") as any;
    expect(ledger.min_author_ratio_bps).toBe(4000);
  });
});
