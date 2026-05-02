import { describe, expect, it } from "vitest";
import { DEMO_RUST_UNSAFE_TRACE_ID, scoreBundle } from "@/lib/mock/judge";
import { ExperienceBundleSchema } from "@/lib/schemas";
import { buildConsoleDemoBundle } from "@/lib/demo/console-bundle";

describe("console demo bundle", () => {
  it("is a schema-valid PRD bundle that receives the scripted 38/50 judge score", () => {
    const bundle = buildConsoleDemoBundle("GitHub PR Review", 1);

    expect(bundle.trace_id).toBe(DEMO_RUST_UNSAFE_TRACE_ID);
    expect(bundle.target_skill.name).toBe("GitHub PR Review");
    expect(ExperienceBundleSchema.safeParse(bundle).success).toBe(true);

    const report = scoreBundle(bundle, []);
    expect(report.weighted_total).toBe(38);
    expect(report.recommendation).toBe("APPROVE");
  });
});
