import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { guarded, contributorOwnershipBps, ownershipPct } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return guarded(async () => {
    const holder = req.nextUrl.searchParams.get("holder") ?? req.headers.get("x-slp-wallet");
    if (!holder) return [];
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT a.*, s.name, s.category, s.author, l.author_ownership_bps, l.contributor_pool_bps, l.total_contributor_weight
         FROM share_accounts a JOIN skills s ON s.skill_id = a.skill_id JOIN share_ledgers l ON l.skill_id = a.skill_id
         WHERE a.holder = ? ORDER BY a.contribution_weight DESC`
      )
      .all(holder) as any[];
    return rows.map((r) => {
      const isAuthor = r.holder === r.author;
      const ownershipBps = isAuthor
        ? r.author_ownership_bps
        : contributorOwnershipBps({
            contributorPoolBps: r.contributor_pool_bps,
            contributionWeight: r.contribution_weight,
            totalContributorWeight: r.total_contributor_weight,
          });
      return {
        skillId: r.skill_id,
        name: r.name,
        category: r.category,
        ownershipBps,
        ownershipPct: ownershipPct(ownershipBps),
        lockUntil: r.lock_until,
        firstContributionAt: r.first_contribution_at,
        lastContributionAt: r.last_contribution_at,
        isAuthor,
      };
    });
  });
}
