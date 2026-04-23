import { describe, it, expect } from "vitest";
import { settlePeriod, computeClaims } from "@/lib/domain/revenue";

const basePool = (over = {}) => ({
  current_period_revenue: 100_000_000, // 0.1 SOL
  total_lifetime_revenue: 0,
  current_period_start: 1_000_000,
  period_length: 300,
  snapshot_total_shares: 0,
  last_settlement_time: 0,
  ...over,
});

describe("settlePeriod", () => {
  it("rejects if period not elapsed", () => {
    const r = settlePeriod({ pool: basePool(), totalShares: 1380, now: 1_000_100 });
    expect(r.canSettle).toBe(false);
    expect(r.reason).toBe("period_not_elapsed");
  });

  it("snapshots shares and rolls the period forward", () => {
    const pool = basePool();
    const r = settlePeriod({ pool, totalShares: 1380, now: pool.current_period_start + pool.period_length + 1 });
    expect(r.canSettle).toBe(true);
    expect(r.snapshotTotalShares).toBe(1380);
    expect(r.newPool.current_period_revenue).toBe(0);
    expect(r.newPool.total_lifetime_revenue).toBe(100_000_000);
    expect(r.newPool.snapshot_total_shares).toBe(1380);
  });
});

describe("computeClaims", () => {
  const two = [
    { holder: "alice", shares: 1000 },
    { holder: "bob", shares: 380 },
  ];

  it("PRD demo: Alice 72.5%, Bob 27.5%, Carol 0", () => {
    const holders = [...two, { holder: "carol", shares: 0 }];
    const claims = computeClaims({ holders, periodRevenue: 100_000_000, totalShares: 1380 });
    // Expected: alice 72_463_768, bob 27_536_231, carol 0, and remainder(1) goes to the largest-share holder (alice).
    const byHolder = Object.fromEntries(claims.map((c) => [c.holder, c.amount]));
    expect(byHolder.alice + byHolder.bob + byHolder.carol).toBe(100_000_000);
    expect(byHolder.alice).toBeCloseTo(72_463_769, -2); // ~72.46%
    expect(byHolder.bob).toBeCloseTo(27_536_231, -2);
    expect(byHolder.carol).toBe(0);
  });

  it("returns all-zero when pool is empty", () => {
    const claims = computeClaims({ holders: two, periodRevenue: 0, totalShares: 1380 });
    expect(claims.every((c) => c.amount === 0)).toBe(true);
  });

  it("single holder gets everything", () => {
    const claims = computeClaims({ holders: [{ holder: "alice", shares: 1000 }], periodRevenue: 500, totalShares: 1000 });
    expect(claims[0].amount).toBe(500);
  });

  it("distributes remainder to largest-shares holder so pool sums to exactly periodRevenue", () => {
    const holders = [
      { holder: "a", shares: 3 },
      { holder: "b", shares: 3 },
      { holder: "c", shares: 4 },
    ];
    const claims = computeClaims({ holders, periodRevenue: 10, totalShares: 10 });
    const sum = claims.reduce((s, c) => s + c.amount, 0);
    expect(sum).toBe(10);
    // 3/10*10=3, 3/10*10=3, 4/10*10=4. No remainder; but if we change to 11:
    const claims2 = computeClaims({ holders, periodRevenue: 11, totalShares: 10 });
    const byHolder = Object.fromEntries(claims2.map((c) => [c.holder, c.amount]));
    expect(byHolder.a + byHolder.b + byHolder.c).toBe(11);
    expect(byHolder.c).toBeGreaterThanOrEqual(byHolder.a);
    expect(byHolder.c).toBeGreaterThanOrEqual(byHolder.b);
  });
});
