import { describe, expect, it } from "vitest";
import { computeOwnershipClaims, settlePeriod } from "@/lib/domain/revenue";

const basePool = (over = {}) => ({
  current_period_revenue: 1000,
  total_lifetime_revenue: 2000,
  current_period_start: 1_000_000,
  period_length: 300,
  snapshot_author_ownership_bps: 0,
  snapshot_contributor_pool_bps: 0,
  last_settlement_time: 0,
  ...over,
});

const byHolder = (claims: { holder: string; amount: number }[]) =>
  Object.fromEntries(claims.map((claim) => [claim.holder, claim.amount]));

describe("settlePeriod", () => {
  it("settles elapsed period and snapshots ownership bps", () => {
    const pool = basePool();
    const now = pool.current_period_start + pool.period_length;

    const result = settlePeriod({
      pool,
      authorOwnershipBps: 4000,
      contributorPoolBps: 6000,
      now,
    });

    expect(result.canSettle).toBe(true);
    expect(result.periodRevenue).toBe(1000);
    expect(result.snapshotAuthorOwnershipBps).toBe(4000);
    expect(result.snapshotContributorPoolBps).toBe(6000);
    expect(result.newPool).toEqual({
      ...pool,
      current_period_revenue: 0,
      total_lifetime_revenue: 3000,
      current_period_start: now,
      snapshot_author_ownership_bps: 4000,
      snapshot_contributor_pool_bps: 6000,
      last_settlement_time: now,
    });
  });

  it('refuses before period elapsed with reason "period_not_elapsed"', () => {
    const pool = basePool();
    const result = settlePeriod({
      pool,
      authorOwnershipBps: 4000,
      contributorPoolBps: 6000,
      now: pool.current_period_start + pool.period_length - 1,
    });

    expect(result.canSettle).toBe(false);
    expect(result.reason).toBe("period_not_elapsed");
    expect(result.periodRevenue).toBe(0);
    expect(result.newPool).toBe(pool);
  });
});

describe("computeOwnershipClaims", () => {
  it("pays author 100% when no contributor weights", () => {
    const claims = computeOwnershipClaims({
      holders: [
        { holder: "author", role: "author", contributionWeight: 0 },
        { holder: "bob", role: "contributor", contributionWeight: 0 },
      ],
      periodRevenue: 1000,
      authorOwnershipBps: 4000,
      contributorPoolBps: 6000,
      totalContributorWeight: 0,
    });

    expect(byHolder(claims)).toEqual({
      author: 1000,
      bob: 0,
    });
  });

  it("splits contributor pool by contribution weight", () => {
    const claims = computeOwnershipClaims({
      holders: [
        { holder: "author", role: "author", contributionWeight: 0 },
        { holder: "bob", role: "contributor", contributionWeight: 1500 },
        { holder: "charlie", role: "contributor", contributionWeight: 500 },
      ],
      periodRevenue: 1000,
      authorOwnershipBps: 4000,
      contributorPoolBps: 6000,
      totalContributorWeight: 2000,
    });

    expect(byHolder(claims)).toEqual({
      author: 400,
      bob: 450,
      charlie: 150,
    });
  });

  it("assigns remainder deterministically to largest effective holder", () => {
    const claims = computeOwnershipClaims({
      holders: [
        { holder: "author", role: "author", contributionWeight: 0 },
        { holder: "bob", role: "contributor", contributionWeight: 1 },
        { holder: "charlie", role: "contributor", contributionWeight: 1 },
      ],
      periodRevenue: 101,
      authorOwnershipBps: 4000,
      contributorPoolBps: 6000,
      totalContributorWeight: 2,
    });

    const amounts = byHolder(claims);
    expect(amounts).toEqual({
      author: 41,
      bob: 30,
      charlie: 30,
    });
    expect(claims.reduce((sum, claim) => sum + claim.amount, 0)).toBe(101);
  });

  it("does not give contributor-pool rounding remainder to author unless author is largest effective holder", () => {
    const claims = computeOwnershipClaims({
      holders: [
        { holder: "author", role: "author", contributionWeight: 0 },
        { holder: "bob", role: "contributor", contributionWeight: 1 },
        { holder: "charlie", role: "contributor", contributionWeight: 1 },
      ],
      periodRevenue: 101,
      authorOwnershipBps: 3000,
      contributorPoolBps: 7000,
      totalContributorWeight: 2,
    });

    const amounts = byHolder(claims);
    expect(amounts).toEqual({
      author: 30,
      bob: 36,
      charlie: 35,
    });
    expect(claims.reduce((sum, claim) => sum + claim.amount, 0)).toBe(101);
  });
});
