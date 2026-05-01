import { describe, expect, it } from "vitest";
import { shouldAutostartIndexer, shouldAutostartJudgeDaemon } from "@/lib/bootstrap-config";

describe("bootstrap autostart config", () => {
  it("starts the judge daemon from its own switch, independent of demo mode", () => {
    expect(shouldAutostartJudgeDaemon({
      DEMO_MODE: "false",
      JUDGE_DAEMON_AUTOSTART: "true",
    })).toBe(true);

    expect(shouldAutostartJudgeDaemon({
      DEMO_MODE: "true",
      JUDGE_DAEMON_AUTOSTART: "false",
    })).toBe(false);
  });

  it("keeps indexer autostart defaulting on unless explicitly disabled", () => {
    expect(shouldAutostartIndexer({})).toBe(true);
    expect(shouldAutostartIndexer({ INDEXER_AUTOSTART: "false" })).toBe(false);
  });
});
