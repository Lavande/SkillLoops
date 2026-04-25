import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ApiError, caller, guarded } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const expId = Number(params.id);
    if (!Number.isFinite(expId)) throw new ApiError(400, "bad_id");
    const self = caller(req);
    const db = getDb();

    const r = db.prepare(`SELECT * FROM experiences WHERE experience_id = ?`).get(expId) as any;
    if (!r) throw new ApiError(404, "experience_not_found");
    const isContributor = self === r.contributor;
    const isShareholder = !!self && ((db.prepare(`SELECT shares FROM share_accounts WHERE holder = ? AND skill_id = ?`).get(self, r.skill_id) as any)?.shares ?? 0) > 0;
    const base = {
      experienceId: r.experience_id,
      skillId: r.skill_id,
      contributor: r.contributor,
      skillVersion: r.skill_version,
      status: r.status,
      contributionScore: r.contribution_score,
      sharesMinted: r.shares_minted,
      submittedAt: r.submitted_at,
      evaluatedAt: r.evaluated_at,
      arweaveTxId: r.arweave_tx_id,
    };
    if (isContributor || isShareholder) {
      return {
        ...base,
        bundle: r.bundle_json ? (() => { try { return JSON.parse(r.bundle_json); } catch { return null; } })() : null,
        judgeReport: r.judge_report_json ? JSON.parse(r.judge_report_json) : null,
        judgeReportTxId: r.judge_report_tx_id,
      };
    }
    return base;
  });
}
