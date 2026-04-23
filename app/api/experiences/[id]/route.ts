import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ApiError, caller, guarded } from "@/lib/api-helpers";
import { evaluatePending } from "@/lib/services";
import { now } from "@/lib/mock/clock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const expId = Number(params.id);
    if (!Number.isFinite(expId)) throw new ApiError(400, "bad_id");
    const self = caller(req);
    const db = getDb();

    // Lazy evaluate: if Pending and older than 3s, fire the judge now so polling
    // recovers when setTimeout was lost (HMR, serverless cold start, etc.).
    const row = db.prepare(`SELECT * FROM experiences WHERE experience_id = ?`).get(expId) as any;
    if (!row) throw new ApiError(404, "experience_not_found");
    if (row.status === "Pending" && row.submitted_at + 3 <= now()) {
      evaluatePending(expId);
    }

    const r = db.prepare(`SELECT * FROM experiences WHERE experience_id = ?`).get(expId) as any;
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
        bundle: JSON.parse(r.bundle_json),
        judgeReport: r.judge_report_json ? JSON.parse(r.judge_report_json) : null,
        judgeReportTxId: r.judge_report_tx_id,
      };
    }
    return base;
  });
}
