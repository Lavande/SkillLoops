import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ApiError, guarded } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { skillId: string } }) {
  return guarded(async () => {
    const db = getDb();
    const ledger = db.prepare(`SELECT * FROM share_ledgers WHERE skill_id = ?`).get(params.skillId) as any;
    if (!ledger) throw new ApiError(404, "ledger_not_found");
    const holders = db
      .prepare(`SELECT * FROM share_accounts WHERE skill_id = ? ORDER BY shares DESC`)
      .all(params.skillId) as any[];
    return {
      ledger: {
        totalShares: ledger.total_shares,
        authorShares: ledger.author_shares,
        minAuthorRatioBps: ledger.min_author_ratio_bps,
        contributorCount: ledger.contributor_count,
      },
      holders: holders.map((h) => ({
        holder: h.holder,
        shares: h.shares,
        lockUntil: h.lock_until,
        firstContributionAt: h.first_contribution_at,
        lastContributionAt: h.last_contribution_at,
      })),
    };
  });
}
