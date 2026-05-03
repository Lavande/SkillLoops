import { OWNERSHIP_BPS } from "./thresholds";

export interface RevenuePoolState {
  current_period_revenue: number;
  total_lifetime_revenue: number;
  current_period_start: number;
  period_length: number;
  snapshot_author_ownership_bps: number;
  snapshot_contributor_pool_bps: number;
  last_settlement_time: number;
}

export interface SettleInput {
  pool: RevenuePoolState;
  authorOwnershipBps: number;
  contributorPoolBps: number;
  now: number;
}

export interface SettleResult {
  canSettle: boolean;
  periodRevenue: number;
  snapshotAuthorOwnershipBps: number;
  snapshotContributorPoolBps: number;
  newPool: RevenuePoolState;
  reason?: string;
}

export function settlePeriod({
  pool,
  authorOwnershipBps,
  contributorPoolBps,
  now,
}: SettleInput): SettleResult {
  if (now < pool.current_period_start + pool.period_length) {
    return {
      canSettle: false,
      periodRevenue: 0,
      snapshotAuthorOwnershipBps: 0,
      snapshotContributorPoolBps: 0,
      newPool: pool,
      reason: "period_not_elapsed",
    };
  }

  const periodRevenue = pool.current_period_revenue;

  return {
    canSettle: true,
    periodRevenue,
    snapshotAuthorOwnershipBps: authorOwnershipBps,
    snapshotContributorPoolBps: contributorPoolBps,
    newPool: {
      ...pool,
      current_period_revenue: 0,
      total_lifetime_revenue: pool.total_lifetime_revenue + periodRevenue,
      current_period_start: now,
      snapshot_author_ownership_bps: authorOwnershipBps,
      snapshot_contributor_pool_bps: contributorPoolBps,
      last_settlement_time: now,
    },
  };
}

export interface OwnershipHolder {
  holder: string;
  role: "author" | "contributor";
  contributionWeight: number;
}

export interface OwnershipClaim {
  holder: string;
  amount: number;
}

export function computeOwnershipClaims({
  holders,
  periodRevenue,
  authorOwnershipBps,
  contributorPoolBps,
  totalContributorWeight,
}: {
  holders: OwnershipHolder[];
  periodRevenue: number;
  authorOwnershipBps: number;
  contributorPoolBps: number;
  totalContributorWeight: number;
}): OwnershipClaim[] {
  if (periodRevenue <= 0) {
    return holders.map((holder) => ({ holder: holder.holder, amount: 0 }));
  }

  const authorClaim = Math.floor((periodRevenue * authorOwnershipBps) / OWNERSHIP_BPS);
  const contributorRevenue = periodRevenue - authorClaim;

  const claims = holders.map((holder) => {
    if (holder.role === "author") {
      return { holder: holder.holder, amount: authorClaim };
    }

    if (
      contributorRevenue <= 0 ||
      totalContributorWeight <= 0 ||
      holder.contributionWeight <= 0
    ) {
      return { holder: holder.holder, amount: 0 };
    }

    return {
      holder: holder.holder,
      amount: Math.floor(
        (contributorRevenue * holder.contributionWeight) / totalContributorWeight,
      ),
    };
  });

  const distributed = claims.reduce((sum, claim) => sum + claim.amount, 0);
  const remainder = periodRevenue - distributed;

  if (remainder > 0 && holders.length > 0) {
    let largestEffectiveHolderIndex = 0;
    let largestEffectiveHolderBps = effectiveOwnershipBps(
      holders[0],
      authorOwnershipBps,
      contributorPoolBps,
      totalContributorWeight,
    );

    for (let index = 1; index < holders.length; index += 1) {
      const effectiveBps = effectiveOwnershipBps(
        holders[index],
        authorOwnershipBps,
        contributorPoolBps,
        totalContributorWeight,
      );
      if (effectiveBps > largestEffectiveHolderBps) {
        largestEffectiveHolderIndex = index;
        largestEffectiveHolderBps = effectiveBps;
      }
    }

    claims[largestEffectiveHolderIndex] = {
      ...claims[largestEffectiveHolderIndex],
      amount: claims[largestEffectiveHolderIndex].amount + remainder,
    };
  }

  return claims;
}

function effectiveOwnershipBps(
  holder: OwnershipHolder,
  authorOwnershipBps: number,
  contributorPoolBps: number,
  totalContributorWeight: number,
): number {
  if (holder.role === "author") {
    return authorOwnershipBps;
  }

  if (totalContributorWeight <= 0 || holder.contributionWeight <= 0) {
    return 0;
  }

  return Math.floor((contributorPoolBps * holder.contributionWeight) / totalContributorWeight);
}
