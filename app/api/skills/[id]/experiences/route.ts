import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { caller, guarded } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const self = caller(req);
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT experience_id, skill_id, contributor, skill_version, status, contribution_score, shares_minted, submitted_at, evaluated_at, arweave_tx_id, bundle_json, judge_report_tx_id, judge_report_json FROM experiences WHERE skill_id = ? ORDER BY submitted_at DESC`
      )
      .all(params.id) as any[];
    return rows.map((r) => {
      const baseVisible = {
        experienceId: r.experience_id,
        contributor: r.contributor,
        skillVersion: r.skill_version,
        status: r.status,
        contributionScore: r.contribution_score,
        sharesMinted: r.shares_minted,
        submittedAt: r.submitted_at,
        evaluatedAt: r.evaluated_at,
        arweaveTxId: r.arweave_tx_id,
      };
      // Shareholders of this skill + the contributor themself see full bundle.
      const allowed =
        self === r.contributor ||
        canSeeShareholderContent(self, params.id);
      return allowed
        ? {
            ...baseVisible,
            bundle: JSON.parse(r.bundle_json),
            judgeReport: r.judge_report_json ? JSON.parse(r.judge_report_json) : null,
            judgeReportTxId: r.judge_report_tx_id,
          }
        : baseVisible;
    });
  });
}

function canSeeShareholderContent(self: string | null, skillId: string): boolean {
  if (!self) return false;
  const db = getDb();
  const row = db
    .prepare(`SELECT shares FROM share_accounts WHERE holder = ? AND skill_id = ?`)
    .get(self, skillId) as { shares: number } | undefined;
  return (row?.shares ?? 0) > 0;
}
