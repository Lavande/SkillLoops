import { DEMO_RUST_UNSAFE_TRACE_ID } from "@/lib/mock/judge";
import type { ExperienceBundle } from "@/lib/schemas";

export function buildConsoleDemoBundle(
  targetSkillName: string,
  skillVersion = 1,
  submittedAt = 1_774_000_000,
): ExperienceBundle {
  return {
    version: "1.0",
    target_skill: {
      name: targetSkillName,
      version: skillVersion,
    },
    skill_version: skillVersion,
    trace_id: DEMO_RUST_UNSAFE_TRACE_ID,
    submitted_at: submittedAt,
    context: {
      task_description: "Review a Rust pull request that introduces an unsafe allocator write.",
      input_summary: "Rust diff adds an unsafe ptr::write path without explaining pointer validity or aliasing invariants.",
    },
    trajectory: [
      {
        step: 1,
        action: "detect_language",
        observation: "Primary language: Rust.",
        result: "ok",
      },
      {
        step: 2,
        action: "review_for_common_smells",
        observation: "The review checks tests and formatting but stays language-agnostic.",
        result: "ok",
      },
      {
        step: 3,
        action: "produce_review",
        observation: "The final review does not mention the unsafe block or its required invariants.",
        result: "missed_critical_issue",
      },
    ],
    outcome: "partial",
    failure_mode: "language_specific_safety_not_covered",
    root_cause_analysis:
      "The skill's review checklist is language-agnostic and has no branch for Rust-specific safety concerns. Unsafe blocks carry invariants around pointer validity, alignment, and aliasing; skipping them defeats the review.",
    lesson_learned:
      "Code-review skills need language-aware branches. For Rust, the agent should audit every unsafe block, explain why it is needed, and check the invariants the author is claiming to uphold.",
    proposed_patch: {
      type: "new_step",
      target_section: "after Step 2, before producing the final review",
      diff: [
        "+ Step 2.5: Language-specific safety audit.",
        "+ If the PR contains Rust code:",
        "+ - Locate every `unsafe` block.",
        "+ - For each block, state the invariant the author must uphold.",
        "+ - Flag any block where validity, alignment, lifetime, or aliasing is not justified.",
      ].join("\n"),
    },
    test_case: {
      input_pr_diff: "diff --git a/src/alloc.rs b/src/alloc.rs\n+ unsafe { ptr::write(dst, value); }",
      expected_review_must_contain: "unsafe block: you are claiming dst is valid, aligned, and not aliased",
    },
    generated_by_reflection_skill_version: "1.0.0",
  };
}
