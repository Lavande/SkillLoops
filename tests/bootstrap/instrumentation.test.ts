import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("server bootstrap instrumentation", () => {
  it("starts background services from the Node.js runtime hook", () => {
    const instrumentation = readSource("instrumentation.ts");
    const nextConfig = readSource("next.config.mjs");
    const layout = readSource("app/layout.tsx");
    const indexer = readSource("lib/indexer.ts");
    const judge = readSource("lib/judge-client.ts");

    expect(instrumentation).toContain('process.env.NEXT_RUNTIME === "nodejs"');
    expect(instrumentation).toContain('await import("./lib/bootstrap")');
    expect(nextConfig).toContain("instrumentationHook: true");
    expect(layout).not.toContain('import "@/lib/bootstrap"');
    expect(indexer).toContain("__slpIndexerRuntime");
    expect(judge).toContain("__slpJudgeRuntime");
  });
});
