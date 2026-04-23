import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { ApiError, caller, guarded } from "@/lib/api-helpers";
import { getSolBalance } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return guarded(async () => {
    const self = caller(req);
    if (!self) throw new ApiError(401, "wallet_required");
    const db = getDb();
    const published = db
      .prepare(
        `SELECT s.*, l.total_shares, l.contributor_count FROM skills s JOIN share_ledgers l ON l.skill_id = s.skill_id WHERE s.author = ? ORDER BY s.created_at DESC`
      )
      .all(self) as any[];
    const subs = db
      .prepare(
        `SELECT su.*, s.name, s.category FROM subscriptions su JOIN skills s ON s.skill_id = su.skill_id WHERE su.subscriber = ? ORDER BY su.start_time DESC`
      )
      .all(self) as any[];
    const holdings = db
      .prepare(
        `SELECT a.*, s.name AS skill_name, s.author, l.total_shares FROM share_accounts a JOIN skills s ON s.skill_id = a.skill_id JOIN share_ledgers l ON l.skill_id = a.skill_id WHERE a.holder = ? AND a.shares > 0 ORDER BY a.shares DESC`
      )
      .all(self) as any[];
    const contributions = db
      .prepare(
        `SELECT e.*, s.name AS skill_name FROM experiences e JOIN skills s ON s.skill_id = e.skill_id WHERE e.contributor = ? ORDER BY e.submitted_at DESC`
      )
      .all(self) as any[];
    const claimable = db
      .prepare(
        `SELECT c.*, s.name AS skill_name FROM claimable_revenue c JOIN skills s ON s.skill_id = c.skill_id WHERE c.holder = ? AND c.amount > 0 ORDER BY c.snapshot_id DESC`
      )
      .all(self) as any[];
    return {
      wallet: self,
      balance: getSolBalance(self),
      published: published.map((r) => ({
        skillId: r.skill_id,
        name: r.name,
        category: r.category,
        currentVersion: r.current_version,
        subscriberCount: r.subscriber_count,
        totalShares: r.total_shares,
        contributorCount: r.contributor_count,
        subscriptionPrice: r.subscription_price,
      })),
      subscriptions: subs.map((r) => ({
        skillId: r.skill_id,
        name: r.name,
        category: r.category,
        startTime: r.start_time,
        expiryTime: r.expiry_time,
        isActive: !!r.is_active,
      })),
      holdings: holdings.map((r) => ({
        skillId: r.skill_id,
        skillName: r.skill_name,
        shares: r.shares,
        totalShares: r.total_shares,
        lockUntil: r.lock_until,
        isAuthor: r.holder === r.author,
      })),
      contributions: contributions.map((r) => ({
        experienceId: r.experience_id,
        skillId: r.skill_id,
        skillName: r.skill_name,
        status: r.status,
        contributionScore: r.contribution_score,
        sharesMinted: r.shares_minted,
        submittedAt: r.submitted_at,
        evaluatedAt: r.evaluated_at,
        arweaveTxId: r.arweave_tx_id,
      })),
      claimable: claimable.map((r) => ({
        skillId: r.skill_id,
        skillName: r.skill_name,
        amount: r.amount,
        snapshotId: r.snapshot_id,
      })),
    };
  });
}
