import { start as startIndexer } from "./indexer";
import { startJudgeDaemon } from "./judge-client";

if (typeof window === "undefined") {
  const autostart = (process.env.INDEXER_AUTOSTART ?? "true") === "true";
  const demo = process.env.DEMO_MODE === "true";

  const g = globalThis as any;
  if (!g.__slpBootstrapped) {
    if (autostart) startIndexer();
    if (demo) startJudgeDaemon();
    g.__slpBootstrapped = true;
  }
}
