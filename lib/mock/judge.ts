import type { ExperienceBundle, JudgeReport } from "@/lib/schemas";

export const DEMO_RUST_UNSAFE_TRACE_ID = "demo-rust-unsafe-2026-04-23";
export const JUDGE_ID = "slp-judge-deterministic-mock-v1";

const W = { novelty: 1.2, specificity: 1.0, actionability: 1.2, reproducibility: 0.8, impact: 0.8 };

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function tokenize(s: string): Set<string> {
  return new Set(
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function specBody(bundle: ExperienceBundle): string {
  return [
    bundle.root_cause_analysis ?? "",
    bundle.lesson_learned ?? "",
    bundle.proposed_patch?.diff ?? "",
  ].join(" ");
}

export function scoreBundle(bundle: ExperienceBundle, prior: ExperienceBundle[]): JudgeReport {
  // Demo override: anchors the /console flow on exactly 38/50 with PRD reasoning.
  if (bundle.trace_id === DEMO_RUST_UNSAFE_TRACE_ID) {
    return {
      experience_id: 0,
      judged_at: Math.floor(Date.now() / 1000),
      judge_id: JUDGE_ID,
      scores: { novelty: 8, specificity: 9, actionability: 8, reproducibility: 7, impact: 6 },
      weighted_total: 38,
      reasoning: {
        novelty: "No prior experience in this skill's history covers Rust-specific safety auditing. Recognized pattern only covers generic smell checks.",
        specificity: "Clear trace with identifiable failure point at step 3.",
        actionability: "The proposed patch specifies exact insertion point and concrete behavior. Author can merge with minor editing.",
        reproducibility: "Test case includes an exact diff snippet and a must-contain assertion; reproducible with minor setup.",
        impact: "Affects every Rust PR reviewed by this skill — a meaningful fraction of target usage.",
      },
      duplicate_check: { is_duplicate: false, similarity_to_existing: 0.14 },
      recommendation: "APPROVE",
    };
  }

  const trajectoryLen = bundle.trajectory?.length ?? 0;
  const specificity = clamp(trajectoryLen * 2, 3, 9);

  const diff = bundle.proposed_patch?.diff ?? "";
  const actionability = diff && diff.includes("+") ? 9 : diff ? 6 : 3;

  const tc = bundle.test_case ?? {};
  const hasInput = Boolean(tc.input_pr_diff || tc.input);
  const hasExpected = Boolean(tc.expected_review_must_contain || tc.expected);
  const reproducibility = hasInput && hasExpected ? 9 : hasInput || hasExpected ? 5 : 2;

  const body = tokenize(specBody(bundle));
  let maxSim = 0;
  for (const p of prior) {
    const sim = jaccard(body, tokenize(specBody(p)));
    if (sim > maxSim) maxSim = sim;
  }
  const novelty = Math.max(2, 8 - Math.floor(8 * maxSim));

  const rca = (bundle.root_cause_analysis ?? "").toLowerCase();
  let impact = 6;
  if (rca.includes("every") || rca.includes("all ") || rca.includes("universal")) impact = 8;
  if ((bundle.outcome ?? "").toLowerCase().includes("edge")) impact = 4;

  const weighted =
    W.novelty * novelty +
    W.specificity * specificity +
    W.actionability * actionability +
    W.reproducibility * reproducibility +
    W.impact * impact;
  const weighted_total = Math.min(50, Math.round(weighted));

  const recommendation = weighted_total >= 20 ? "APPROVE" : "REJECT";

  return {
    experience_id: 0,
    judged_at: Math.floor(Date.now() / 1000),
    judge_id: JUDGE_ID,
    scores: { novelty, specificity, actionability, reproducibility, impact },
    weighted_total,
    reasoning: {
      novelty:
        maxSim < 0.2
          ? "No close prior; looks like a fresh blind spot."
          : maxSim < 0.5
          ? "Some overlap with prior contributions but meaningfully different angle."
          : "Substantial overlap with existing contributions; credit limited.",
      specificity:
        trajectoryLen >= 3
          ? "Trajectory has enough steps to locate the failure point."
          : "Trajectory is sparse; failure point is plausible but not fully traceable.",
      actionability: diff.includes("+")
        ? "Patch contains concrete additions to the skill text."
        : diff
        ? "Patch describes a direction but is not merge-ready as-is."
        : "No actionable patch provided.",
      reproducibility:
        hasInput && hasExpected
          ? "Test case pairs a concrete input with an expected assertion."
          : hasInput || hasExpected
          ? "Test case is partial."
          : "No test case provided.",
      impact:
        impact >= 8
          ? "Root cause reads as universal for this skill's target use."
          : impact === 6
          ? "Affects a meaningful slice of the skill's users."
          : "Scope reads as narrow.",
    },
    duplicate_check: { is_duplicate: maxSim >= 0.7, similarity_to_existing: Number(maxSim.toFixed(2)) },
    recommendation,
  };
}
