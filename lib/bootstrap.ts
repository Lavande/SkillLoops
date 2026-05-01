import { start as startIndexer } from "./indexer";
import { startJudgeDaemon } from "./judge-client";
import { shouldAutostartIndexer, shouldAutostartJudgeDaemon } from "./bootstrap-config";

if (typeof window === "undefined") {
  const g = globalThis as any;
  if (!g.__slpBootstrapped) {
    if (shouldAutostartIndexer()) startIndexer();
    if (shouldAutostartJudgeDaemon()) startJudgeDaemon();
    g.__slpBootstrapped = true;
  }
}
