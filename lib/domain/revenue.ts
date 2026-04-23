export interface RevenuePoolState {
  current_period_revenue: number;
  total_lifetime_revenue: number;
  current_period_start: number;
  period_length: number;
  snapshot_total_shares: number;
  last_settlement_time: number;
}

export interface SettleInput {
  pool: RevenuePoolState;
  totalShares: number;
  now: number;
}

export interface SettleResult {
  canSettle: boolean;
  periodRevenue: number;
  snapshotTotalShares: number;
  newPool: RevenuePoolState;
  reason?: string;
}

export function settlePeriod({ pool, totalShares, now }: SettleInput): SettleResult {
  if (now < pool.current_period_start + pool.period_length) {
    return {
      canSettle: false,
      periodRevenue: 0,
      snapshotTotalShares: 0,
      newPool: pool,
      reason: "period_not_elapsed",
    };
  }
  const periodRevenue = pool.current_period_revenue;
  return {
    canSettle: true,
    periodRevenue,
    snapshotTotalShares: totalShares,
    newPool: {
      ...pool,
      current_period_revenue: 0,
      total_lifetime_revenue: pool.total_lifetime_revenue + periodRevenue,
      current_period_start: now,
      snapshot_total_shares: totalShares,
      last_settlement_time: now,
    },
  };
}

export interface Holder {
  holder: string;
  shares: number;
}
export interface Claim {
  holder: string;
  amount: number;
}

/**
 * Distribute `periodRevenue` lamports proportional to `shares_i / totalShares`.
 * Integer-safe: floor divide, then assign remainder to the largest-shares holder
 * so the pool settles to exactly zero. Holders with 0 shares get 0 lamports.
 */
export function computeClaims({
  holders,
  periodRevenue,
  totalShares,
}: {
  holders: Holder[];
  periodRevenue: number;
  totalShares: number;
}): Claim[] {
  if (periodRevenue <= 0 || totalShares <= 0) {
    return holders.map((h) => ({ holder: h.holder, amount: 0 }));
  }
  const claims = holders.map((h) => {
    const amount = h.shares > 0 ? Math.floor((periodRevenue * h.shares) / totalShares) : 0;
    return { holder: h.holder, amount };
  });
  const distributed = claims.reduce((s, c) => s + c.amount, 0);
  const remainder = periodRevenue - distributed;
  if (remainder > 0) {
    // Give remainder to the largest-shares holder (ties broken by earliest in list).
    let maxIdx = -1;
    let maxShares = 0;
    holders.forEach((h, i) => {
      if (h.shares > maxShares) {
        maxShares = h.shares;
        maxIdx = i;
      }
    });
    if (maxIdx >= 0) claims[maxIdx] = { ...claims[maxIdx], amount: claims[maxIdx].amount + remainder };
  }
  return claims;
}
