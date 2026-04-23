import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, guarded } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { DEMO_PERSONAS, seedDemoIfEmpty } from "@/lib/seed/demo";
import {
  evaluatePending,
  publishSkill,
  subscribe,
  submitExperience,
  settleRevenue,
  claimRevenue,
  getPeriodLengthSeconds,
  publishNewVersion,
} from "@/lib/services";
import { ArweaveMock } from "@/lib/mock/arweave";
import { DEMO_RUST_UNSAFE_TRACE_ID } from "@/lib/mock/judge";
import { solToLamports } from "@/lib/units";
import { now } from "@/lib/mock/clock";
import { sha256Hex } from "@/lib/services";

export const dynamic = "force-dynamic";

const Body = z.object({
  step: z.enum([
    "reset",
    "seed",
    "subscribe_bob",
    "submit_bob_experience",
    "evaluate",
    "subscribe_carol",
    "force_settle_ready",
    "settle",
    "claim_alice",
    "claim_bob",
    "publish_v1_1",
  ]),
});

export async function POST(req: NextRequest) {
  return guarded(async () => {
    if (process.env.DEMO_MODE !== "true") throw new ApiError(403, "demo_mode_required");
    const { step } = Body.parse(await req.json());
    const db = getDb();
    const aliceSkill = () => {
      const row = db
        .prepare(`SELECT skill_id FROM skills WHERE author = ? AND name = 'GitHub PR Review'`)
        .get(DEMO_PERSONAS.alice) as any;
      if (!row) throw new ApiError(404, "alice_skill_missing_seed_first");
      return row.skill_id as string;
    };

    switch (step) {
      case "reset": {
        // Purge content tables but keep DB.
        const tables = [
          "claimable_revenue",
          "revenue_history",
          "revenue_pools",
          "experiences",
          "share_accounts",
          "share_ledgers",
          "subscriptions",
          "skill_versions",
          "skills",
          "arweave_objects",
          "balances",
        ];
        db.transaction(() => {
          for (const t of tables) db.prepare(`DELETE FROM ${t}`).run();
        })();
        return { ok: true };
      }
      case "seed": {
        return seedDemoIfEmpty();
      }
      case "subscribe_bob": {
        return { ...subscribe({ subscriber: DEMO_PERSONAS.bob, skillId: aliceSkill() }), skillId: aliceSkill() };
      }
      case "subscribe_carol": {
        return { ...subscribe({ subscriber: DEMO_PERSONAS.carol, skillId: aliceSkill() }), skillId: aliceSkill() };
      }
      case "submit_bob_experience": {
        const skillId = aliceSkill();
        const bundle = buildDemoBundle(skillId);
        const json = JSON.stringify(bundle);
        const up = ArweaveMock.upload(json, [
          { name: "Protocol", value: "SLP" },
          { name: "Type", value: "ExperienceBundle" },
          { name: "SkillId", value: skillId },
        ], DEMO_PERSONAS.bob);
        const s = submitExperience({
          contributor: DEMO_PERSONAS.bob,
          skillId,
          arweaveTxId: up.txId,
          bundleJson: json,
        });
        return { experienceId: s.experienceId, arweaveTxId: up.txId, skillId };
      }
      case "evaluate": {
        evaluatePending();
        return { ok: true };
      }
      case "force_settle_ready": {
        // Rewinds current_period_start so `settle` can proceed immediately.
        const skillId = aliceSkill();
        const pool = db.prepare(`SELECT period_length FROM revenue_pools WHERE skill_id = ?`).get(skillId) as any;
        const t = now() - (pool.period_length as number) - 1;
        db.prepare(`UPDATE revenue_pools SET current_period_start = ? WHERE skill_id = ?`).run(t, skillId);
        return { ok: true };
      }
      case "settle": {
        return settleRevenue({ skillId: aliceSkill() });
      }
      case "claim_alice": {
        return claimRevenue({ skillId: aliceSkill(), holder: DEMO_PERSONAS.alice });
      }
      case "claim_bob": {
        return claimRevenue({ skillId: aliceSkill(), holder: DEMO_PERSONAS.bob });
      }
      case "publish_v1_1": {
        // Append a synthetic patch to the skill and publish a new version.
        const skillId = aliceSkill();
        const extraSection = `\n\n## Step 2.5 — Language-specific safety audit (v1.1)\n\nIf the PR contains Rust code:\n- Locate all \`unsafe\` blocks.\n- For each, explain the invariant the author must uphold.\n- Flag any block where the invariant is not obviously satisfied.\n`;
        // pull last published content from arweave, or fall back
        const skill = db.prepare(`SELECT arweave_tx_id FROM skills WHERE skill_id = ?`).get(skillId) as any;
        const last = ArweaveMock.fetch(skill.arweave_tx_id);
        let base = "# GitHub PR Review v1\n";
        if (last) {
          const decMaybe = last.content.startsWith("enc::") ? last.content.split("::").slice(2).join("::") : last.content;
          try {
            base = Buffer.from(decMaybe, "base64").toString("utf8");
          } catch {}
        }
        const content = base + extraSection;
        const lastExp = db
          .prepare(`SELECT experience_id FROM experiences WHERE skill_id = ? AND status = 'Evaluated' ORDER BY evaluated_at DESC LIMIT 1`)
          .get(skillId) as any;
        return publishNewVersion({
          skillId,
          caller: DEMO_PERSONAS.alice,
          content,
          contributingExperienceIds: lastExp ? [lastExp.experience_id] : [],
        });
      }
    }
    throw new ApiError(400, "unknown_step");
  });
}

function buildDemoBundle(skillId: string) {
  return {
    version: "1.0",
    skill_id: skillId,
    skill_version: 1,
    trace_id: DEMO_RUST_UNSAFE_TRACE_ID,
    submitted_at: now(),
    context: {
      task_description: "Review this pull request",
      input_summary: "Rust PR introducing an unsafe block in the allocator path",
    },
    trajectory: [
      { step: 1, action: "detect_language", observation: "primary language: Rust", result: "ok" },
      { step: 2, action: "review_for_common_smells", observation: "no style issues found; no missing tests flagged", result: "ok" },
      { step: 3, action: "produce_review", observation: "review delivered but makes no mention of unsafe block safety", result: "missed_critical_issue" },
    ],
    outcome: "partial",
    failure_mode: "language_specific_safety_not_covered",
    root_cause_analysis:
      "The skill's review checklist is language-agnostic and has no branch for Rust-specific concerns. `unsafe` blocks carry strong invariants (valid pointers, aliasing, etc.) and not flagging them defeats the purpose of review. This affects every Rust PR reviewed by this skill.",
    lesson_learned:
      "Skills for code review need language-aware branches. For Rust, the agent should specifically audit `unsafe` blocks, explain why each one is needed, and check the invariants the author is implicitly claiming to uphold.",
    proposed_patch: {
      type: "new_step",
      target_section: "after Step 2 (common smell check), before Step 3 (produce review)",
      diff: "+ Step 2.5: Language-specific safety audit.\n+   If the PR contains Rust code:\n+     - Locate all `unsafe` blocks.\n+     - For each, explain the invariant the author must uphold.\n+     - Flag any block where the invariant is not obviously satisfied.\n+   If the PR contains C/C++, apply analogous manual-memory-management checks.",
    },
    test_case: {
      input_pr_diff: "diff --git a/src/alloc.rs ...\n+ unsafe { ptr::write(dst, value); }",
      expected_review_must_contain: "unsafe block: you are claiming `dst` is valid, aligned, and not aliased",
    },
    generated_by_reflection_skill_version: "1.0.0",
  };
}
