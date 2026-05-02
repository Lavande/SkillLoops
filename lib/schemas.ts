import { z } from "zod";

/* ============ ExperienceBundle (PRD §4.2) ============ */

export const TrajectoryStepSchema = z.object({
  step: z.number().int().nonnegative(),
  action: z.string(),
  observation: z.string(),
  result: z.string(),
});

export const ProposedPatchSchema = z.object({
  type: z.string(),
  target_section: z.string(),
  diff: z.string(),
});

export const TestCaseSchema = z
  .object({
    input_pr_diff: z.string().optional(),
    input: z.string().optional(),
    expected_review_must_contain: z.string().optional(),
    expected: z.string().optional(),
  })
  .refine((v) => Boolean(v.input_pr_diff || v.input || v.expected_review_must_contain || v.expected), {
    message: "test_case must include an input or expected field",
  });

export const TargetSkillSchema = z.object({
  name: z.string().min(1),
  version: z.number().int().positive().optional(),
});

export const ExperienceBundleSchema = z.object({
  version: z.string(),
  target_skill: TargetSkillSchema,
  skill_version: z.number().int().positive(),
  trace_id: z.string(),
  submitted_at: z.number().int().positive(),
  context: z.object({
    task_description: z.string(),
    input_summary: z.string(),
  }),
  trajectory: z.array(TrajectoryStepSchema).min(1),
  outcome: z.string(),
  failure_mode: z.string().optional(),
  root_cause_analysis: z.string().min(10),
  lesson_learned: z.string().min(10),
  proposed_patch: ProposedPatchSchema,
  test_case: TestCaseSchema,
  generated_by_reflection_skill_version: z.string(),
});

export type ExperienceBundle = z.infer<typeof ExperienceBundleSchema>;

/* ============ Judge report ============ */

export const JudgeReportSchema = z.object({
  experience_id: z.number(),
  judged_at: z.number(),
  judge_id: z.string(),
  scores: z.object({
    novelty: z.number(),
    specificity: z.number(),
    actionability: z.number(),
    reproducibility: z.number(),
    impact: z.number(),
  }),
  weighted_total: z.number(),
  reasoning: z.object({
    novelty: z.string(),
    specificity: z.string(),
    actionability: z.string(),
    reproducibility: z.string(),
    impact: z.string(),
  }),
  duplicate_check: z.object({
    is_duplicate: z.boolean(),
    similarity_to_existing: z.number(),
  }),
  recommendation: z.enum(["APPROVE", "REJECT"]),
});

export type JudgeReport = z.infer<typeof JudgeReportSchema>;

/* ============ API I/O ============ */

export const PublishSkillSchema = z.object({
  name: z.string().min(2).max(64),
  description: z.string().min(2).max(256),
  category: z.string().min(1).max(32),
  content: z.string().min(10), // SKILL.md plaintext
  subscription_price_sol: z.number().positive(),
  min_author_ratio_bps: z.number().int().min(3000).max(9500),
});

export const SubscribeSchema = z.object({
  skill_id: z.string(),
});

export const SubmitExperienceSchema = z.object({
  skill_id: z.string(),
  arweave_tx_id: z.string(),
  bundle_json: z.string(),
});

export const PublishVersionSchema = z.object({
  content: z.string().min(10),
  contributing_experience_ids: z.array(z.number()).default([]),
});
