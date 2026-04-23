import { describe, it, expect } from "vitest";
import { scoreBundle, DEMO_RUST_UNSAFE_TRACE_ID } from "@/lib/mock/judge";
import type { ExperienceBundle } from "@/lib/schemas";

function buildBundle(over: Partial<ExperienceBundle> = {}): ExperienceBundle {
  const base: ExperienceBundle = {
    version: "1.0",
    skill_id: "skill_demo",
    skill_version: 1,
    trace_id: "generic-1",
    submitted_at: 1_700_000_000,
    context: { task_description: "task", input_summary: "input" },
    trajectory: [
      { step: 1, action: "a", observation: "o", result: "ok" },
      { step: 2, action: "b", observation: "o", result: "ok" },
      { step: 3, action: "c", observation: "o", result: "missed" },
    ],
    outcome: "partial",
    root_cause_analysis: "the skill has no branch for language-specific safety concerns across every Rust PR",
    lesson_learned: "add a language-aware branch",
    proposed_patch: { type: "new_step", target_section: "step 2", diff: "+ new step" },
    test_case: { input_pr_diff: "diff", expected_review_must_contain: "x" },
    generated_by_reflection_skill_version: "1.0.0",
  };
  return { ...base, ...over };
}

describe("scoreBundle", () => {
  it("demo trace id returns 38/50 exactly", () => {
    const r = scoreBundle(buildBundle({ trace_id: DEMO_RUST_UNSAFE_TRACE_ID }), []);
    expect(r.weighted_total).toBe(38);
    expect(r.recommendation).toBe("APPROVE");
    expect(r.duplicate_check.similarity_to_existing).toBe(0.14);
  });

  it("generic full bundle scores above approve threshold", () => {
    const r = scoreBundle(buildBundle(), []);
    expect(r.weighted_total).toBeGreaterThanOrEqual(20);
    expect(r.recommendation).toBe("APPROVE");
  });

  it("missing patch and test case cause rejection", () => {
    const b = buildBundle({
      proposed_patch: { type: "new_step", target_section: "step 2", diff: "" },
      test_case: { input_pr_diff: "", expected_review_must_contain: "" } as any,
    });
    const r = scoreBundle(b, []);
    // With no patch and no test case, actionability=3, reproducibility=2,
    // specificity=6, novelty~8 (no prior), impact=8 (mentions "every")
    // 1.2*8 + 1.0*6 + 1.2*3 + 0.8*2 + 0.8*8 = 9.6+6+3.6+1.6+6.4 = 27.2 -> 27
    expect(r.scores.actionability).toBe(3);
    expect(r.scores.reproducibility).toBe(2);
  });

  it("duplicate flag triggers when similarity is high", () => {
    const a = buildBundle({ trace_id: "t1" });
    const b = buildBundle({ trace_id: "t2" }); // identical body
    const r = scoreBundle(b, [a]);
    expect(r.duplicate_check.is_duplicate).toBe(true);
    expect(r.scores.novelty).toBe(2); // minimum
  });

  it("deterministic: same input, same output", () => {
    const a = scoreBundle(buildBundle(), []);
    const b = scoreBundle(buildBundle(), []);
    expect(a.scores).toEqual(b.scores);
    expect(a.weighted_total).toBe(b.weighted_total);
  });
});
