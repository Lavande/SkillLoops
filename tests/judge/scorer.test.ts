import { describe, expect, it, vi } from "vitest";
import { anthropicJudgeScorer, getJudgeScorer, mockJudgeScorer } from "@/lib/judge/scorer";
import type { ExperienceBundle } from "@/lib/schemas";

function bundle(over: Partial<ExperienceBundle> = {}): ExperienceBundle {
  return {
    version: "1.0",
    skill_id: "skill_demo",
    skill_version: 1,
    trace_id: "generic-1",
    submitted_at: 1_700_000_000,
    context: { task_description: "task", input_summary: "input" },
    trajectory: [{ step: 1, action: "a", observation: "o", result: "missed" }],
    outcome: "partial",
    root_cause_analysis: "the skill misses a language specific safety branch",
    lesson_learned: "add explicit safety checks",
    proposed_patch: { type: "new_step", target_section: "step 2", diff: "+ check unsafe blocks" },
    test_case: { input_pr_diff: "diff", expected_review_must_contain: "unsafe" },
    generated_by_reflection_skill_version: "1.0.0",
    ...over,
  };
}

describe("judge scorer selection", () => {
  it("defaults to mock scorer", () => {
    expect(getJudgeScorer({}).name).toBe("mock");
  });

  it("selects Anthropic scorer with JUDGE_BACKEND=anthropic", () => {
    expect(getJudgeScorer({ JUDGE_BACKEND: "anthropic" }).name).toBe("anthropic");
  });

  it("mock scorer preserves deterministic behavior", async () => {
    const report = await mockJudgeScorer.score(bundle(), []);
    expect(report.recommendation).toBe("APPROVE");
    expect(report.weighted_total).toBeGreaterThanOrEqual(20);
  });
});

describe("anthropicJudgeScorer", () => {
  it("parses valid tool output and fills runtime fields", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        content: [{
          type: "tool_use",
          name: "record_judge_report",
          input: {
            judge_id: "anthropic:test-model",
            scores: { novelty: 8, specificity: 7, actionability: 9, reproducibility: 6, impact: 8 },
            weighted_total: 39,
            reasoning: { novelty: "fresh", specificity: "trace", actionability: "patch", reproducibility: "test", impact: "broad" },
            duplicate_check: { is_duplicate: false, similarity_to_existing: 0.1 },
            recommendation: "APPROVE",
          },
        }],
      })
    );

    const report = await anthropicJudgeScorer.score(bundle(), [], {
      env: { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "test-model" },
      fetchImpl,
      now: () => 1234,
    });

    expect(report.experience_id).toBe(0);
    expect(report.judged_at).toBe(1234);
    expect(report.weighted_total).toBe(39);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.any(Object));
  });

  it("rejects malformed tool output", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ content: [{ type: "tool_use", name: "record_judge_report", input: { weighted_total: 99 } }] })
    );

    await expect(
      anthropicJudgeScorer.score(bundle(), [], {
        env: { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "test-model" },
        fetchImpl,
      })
    ).rejects.toThrow(/anthropic_judge_invalid_report/);
  });
});
