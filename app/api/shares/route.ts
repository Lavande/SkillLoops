import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { guarded } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return guarded(async () => {
    const holder = req.nextUrl.searchParams.get("holder") ?? req.headers.get("x-slp-wallet");
    if (!holder) return [];
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT a.*, s.name, s.category, l.total_shares FROM share_accounts a JOIN skills s ON s.skill_id = a.skill_id JOIN share_ledgers l ON l.skill_id = a.skill_id WHERE a.holder = ? ORDER BY a.shares DESC`
      )
      .all(holder) as any[];
    return rows.map((r) => ({
      skillId: r.skill_id,
      name: r.name,
      category: r.category,
      shares: r.shares,
      totalShares: r.total_shares,
      lockUntil: r.lock_until,
      firstContributionAt: r.first_contribution_at,
      lastContributionAt: r.last_contribution_at,
      isAuthor: r.holder === r.author,
    }));
  });
}
