import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { caller, guarded, ApiError } from "@/lib/api-helpers";
import { now } from "@/lib/mock/clock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const db = getDb();
    const self = caller(req);
    const skill = db
      .prepare(`SELECT * FROM skills WHERE skill_id = ?`)
      .get(params.id) as any;
    if (!skill) throw new ApiError(404, "skill_not_found");
    const ledger = db.prepare(`SELECT * FROM share_ledgers WHERE skill_id = ?`).get(params.id) as any;
    const holders = db
      .prepare(`SELECT holder, shares, lock_until, first_contribution_at, last_contribution_at FROM share_accounts WHERE skill_id = ? ORDER BY shares DESC`)
      .all(params.id) as any[];
    const versions = db
      .prepare(`SELECT * FROM skill_versions WHERE skill_id = ? ORDER BY version DESC`)
      .all(params.id) as any[];
    const pool = db.prepare(`SELECT * FROM revenue_pools WHERE skill_id = ?`).get(params.id) as any;
    const history = db
      .prepare(`SELECT * FROM revenue_history WHERE skill_id = ? ORDER BY period_start ASC`)
      .all(params.id) as any[];
    const experiences = db
      .prepare(`SELECT experience_id, contributor, skill_version, status, contribution_score, shares_minted, submitted_at, evaluated_at, arweave_tx_id FROM experiences WHERE skill_id = ? ORDER BY submitted_at DESC`)
      .all(params.id) as any[];

    const subscription = self
      ? (db
          .prepare(`SELECT * FROM subscriptions WHERE subscriber = ? AND skill_id = ?`)
          .get(self, params.id) as any)
      : null;
    const selfIsAuthor = self === skill.author;
    const selfHasActiveSub = subscription && subscription.is_active && subscription.expiry_time > now();
    const selfIsShareholder =
      !!self &&
      (db.prepare(`SELECT shares FROM share_accounts WHERE holder = ? AND skill_id = ?`).get(self, params.id) as any)
        ?.shares > 0;

    return {
      skill: {
        skillId: skill.skill_id,
        author: skill.author,
        name: skill.name,
        description: skill.description,
        category: skill.category,
        currentVersion: skill.current_version,
        contentHash: skill.content_hash,
        arweaveTxId: skill.arweave_tx_id,
        subscriptionPrice: skill.subscription_price,
        minAuthorRatioBps: skill.min_author_ratio_bps,
        createdAt: skill.created_at,
        updatedAt: skill.updated_at,
        subscriberCount: skill.subscriber_count,
        totalRevenue: skill.total_revenue,
      },
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
        isAuthor: h.holder === skill.author,
      })),
      versions: versions.map((v) => ({
        version: v.version,
        contentHash: v.content_hash,
        arweaveTxId: v.arweave_tx_id,
        contributingExperienceIds: JSON.parse(v.contributing_experience_ids),
        publishedAt: v.published_at,
      })),
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
      })),
      experiences: experiences.map((e) => ({
        experienceId: e.experience_id,
        contributor: e.contributor,
        skillVersion: e.skill_version,
        status: e.status,
        contributionScore: e.contribution_score,
        sharesMinted: e.shares_minted,
        submittedAt: e.submitted_at,
        evaluatedAt: e.evaluated_at,
        arweaveTxId: e.arweave_tx_id,
      })),
      caller: {
        wallet: self,
        isAuthor: selfIsAuthor,
        isSubscriber: !!selfHasActiveSub,
        isShareholder: !!selfIsShareholder,
        subscription: subscription
          ? { startTime: subscription.start_time, expiryTime: subscription.expiry_time, isActive: selfHasActiveSub }
          : null,
      },
    };
  });
}
