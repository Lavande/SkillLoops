import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ApiError, guarded } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { skillId: string } }) {
  return guarded(async () => {
    const db = getDb();
    const pool = db.prepare(`SELECT * FROM revenue_pools WHERE skill_id = ?`).get(params.skillId) as any;
    if (!pool) throw new ApiError(404, "pool_not_found");
    const history = db
      .prepare(`SELECT * FROM revenue_history WHERE skill_id = ? ORDER BY period_start ASC`)
      .all(params.skillId) as any[];
    return {
      pool: {
        currentPeriodRevenue: pool.current_period_revenue,
        totalLifetimeRevenue: pool.total_lifetime_revenue,
        currentPeriodStart: pool.current_period_start,
        periodLength: pool.period_length,
        lastSettlementTime: pool.last_settlement_time,
      },
      history: history.map((h) => ({
        periodStart: h.period_start,
        periodEnd: h.period_end,
        revenue: h.period_revenue,
        snapshotTotalShares: h.snapshot_total_shares,
      })),
    };
  });
}
