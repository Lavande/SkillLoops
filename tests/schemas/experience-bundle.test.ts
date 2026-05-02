import { describe, expect, it } from "vitest";
import { ExperienceBundleSchema } from "@/lib/schemas";

const baseBundle = {
  version: "1.0",
  target_skill: {
    name: "SLP Canary Access Reviewer",
    version: 1,
  },
  skill_version: 1,
  trace_id: "8f3a9b2e-4d11-4c6a-9f72-1c0e5a8d7b21",
  submitted_at: 1_746_144_000,
  context: {
    task_description: "Review a SkillLoops frontend diff.",
    input_summary: "Access predicate widened in the preview branch.",
  },
  trajectory: [
    {
      step: 1,
      action: "identify_policy_change",
      observation: "A new role was added to an access predicate.",
      result: "missed",
    },
  ],
  outcome: "failure",
  failure_mode: "predicate_widening_not_flagged",
  root_cause_analysis: "The skill validated enforcement but did not question whether the new role belonged in the policy.",
  lesson_learned: "Access predicate widening must be reviewed as a policy change even when enforcement is server-side.",
  proposed_patch: {
    type: "new_step",
    target_section: "Review steps",
    diff: "+ Predicate-widening check",
  },
  test_case: {
    input_pr_diff: "diff --git a/app/page.tsx b/app/page.tsx",
    expected_review_must_contain: "predicate widened",
  },
  generated_by_reflection_skill_version: "1.0.0",
};

describe("ExperienceBundleSchema", () => {
  it("accepts a target skill name without a chain skill id", () => {
    const result = ExperienceBundleSchema.safeParse(baseBundle);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.target_skill.name).toBe("SLP Canary Access Reviewer");
      expect("skill_id" in result.data).toBe(false);
    }
  });

  it("requires target_skill.name", () => {
    const result = ExperienceBundleSchema.safeParse({
      ...baseBundle,
      target_skill: { version: 1 },
    });

    expect(result.success).toBe(false);
  });
});
