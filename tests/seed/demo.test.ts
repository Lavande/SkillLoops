import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { seedDemoIfEmpty } from "@/lib/seed/demo";

let dbPath: string;

beforeEach(() => {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "slp-seed-"));
  dbPath = path.join(dir, "test.sqlite");
});

describe("seedDemoIfEmpty", () => {
  it("seeds local SQLite demo data when all runtime backends are mock", () => {
    const report = seedDemoIfEmpty(
      {
        STORAGE_BACKEND: "mock",
        JUDGE_BACKEND: "mock",
        NEXT_PUBLIC_STORAGE_MODE: "api",
        NEXT_PUBLIC_LIT_MODE: "mock",
      },
      dbPath,
    );

    const db = getDb(dbPath);
    const rows = db.prepare(`SELECT name FROM skills ORDER BY name`).all() as Array<{ name: string }>;

    expect(report.seeded).toBe(true);
    expect(report.aliceSkillId).toBeTruthy();
    expect(rows.map((r) => r.name)).toContain("GitHub PR Review");
  });

  it("does not local-seed when any real backend is selected", () => {
    const report = seedDemoIfEmpty(
      {
        STORAGE_BACKEND: "irys",
        JUDGE_BACKEND: "mock",
        NEXT_PUBLIC_STORAGE_MODE: "api",
        NEXT_PUBLIC_LIT_MODE: "mock",
      },
      dbPath,
    );

    expect(report.seeded).toBe(false);
    expect(report.skills).toBe(0);
    expect(report.aliceSkillId).toBeNull();
  });
});
