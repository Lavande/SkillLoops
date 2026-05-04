import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ApiError, guarded, contributorOwnershipBps, ownershipPct } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { skillId: string } }) {
  return guarded(async () => {
    const db = getDb();
    const ledger = db.prepare(`SELECT * FROM share_ledgers WHERE skill_id = ?`).get(params.skillId) as any;
    if (!ledger) throw new ApiError(404, "ledger_not_found");
    const skill = db.prepare(`SELECT author FROM skills WHERE skill_id = ?`).get(params.skillId) as any;
    const holders = db
      .prepare(`SELECT * FROM share_accounts WHERE skill_id = ? ORDER BY contribution_weight DESC`)
      .all(params.skillId) as any[];
    return {
      ledger: {
        authorOwnershipBps: ledger.author_ownership_bps,
        authorOwnershipPct: ownershipPct(ledger.author_ownership_bps),
        contributorPoolBps: ledger.contributor_pool_bps,
        contributorPoolPct: ownershipPct(ledger.contributor_pool_bps),
        minAuthorRatioBps: ledger.min_author_ratio_bps,
        totalContributorWeight: ledger.total_contributor_weight,
        contributorCount: ledger.contributor_count,
      },
      holders: holders.map((h) => {
        const isAuthor = h.holder === skill?.author;
        const ownershipBps = isAuthor
          ? ledger.author_ownership_bps
          : contributorOwnershipBps({
              contributorPoolBps: ledger.contributor_pool_bps,
              contributionWeight: h.contribution_weight,
              totalContributorWeight: ledger.total_contributor_weight,
            });
        return {
          holder: h.holder,
          role: isAuthor ? "author" : "contributor",
          ownershipBps,
          ownershipPct: ownershipPct(ownershipBps),
          lockUntil: h.lock_until,
          firstContributionAt: h.first_contribution_at,
          lastContributionAt: h.last_contribution_at,
        };
      }),
    };
  });
}
