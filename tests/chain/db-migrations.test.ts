import { describe, it, expect, beforeEach } from "vitest";
import { _resetSingletonForTesting, getDb } from "@/lib/db";

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
});
