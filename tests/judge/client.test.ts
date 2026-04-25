import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("judge client wiring", () => {
  it("uses scorer and storage adapters instead of direct mocks", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/judge-client.ts"), "utf8");
    expect(src).toContain("getJudgeScorer");
    expect(src).toContain("getStorageBackend");
    expect(src).not.toContain("scoreBundle");
    expect(src).not.toContain("ArweaveMock");
  });
});
