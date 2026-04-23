import { describe, it, expect } from "vitest";
import { mintContributionShares } from "@/lib/domain/shares";

const baseLedger = (over = {}) => ({
  total_shares: 1000,
  author_shares: 1000,
  min_author_ratio_bps: 4000, // 40% floor
  contributor_count: 0,
  ...over,
});

describe("mintContributionShares", () => {
  it("rejects below threshold", () => {
    const r = mintContributionShares({ score: 19, ledger: baseLedger(), contributorIsNew: true });
    expect(r.sharesToMint).toBe(0);
    expect(r.newLedger.total_shares).toBe(1000);
  });

  it("mints score*k when floor has room", () => {
    const r = mintContributionShares({ score: 38, ledger: baseLedger(), contributorIsNew: true });
    // max_total = floor(1000*10000/4000) = 2500; headroom = 1500; base = 380
    expect(r.sharesToMint).toBe(380);
    expect(r.newLedger.total_shares).toBe(1380);
    expect(r.floorHit).toBe(false);
    expect(r.newLedger.contributor_count).toBe(1);
  });

  it("PRD demo scenario: 38/50 -> Alice 1000 stays, Bob gets 380, ratios 72.5/27.5", () => {
    const r = mintContributionShares({ score: 38, ledger: baseLedger(), contributorIsNew: true });
    const authorPct = r.newLedger.author_shares / r.newLedger.total_shares;
    const bobPct = r.sharesToMint / r.newLedger.total_shares;
    expect(authorPct).toBeCloseTo(0.7246376, 4);
    expect(bobPct).toBeCloseTo(0.2753623, 4);
  });

  it("caps to author floor and reports floorHit", () => {
    // Floor 40% with author 1000 and already 2400 total => headroom 100
    const ledger = baseLedger({ total_shares: 2400 });
    const r = mintContributionShares({ score: 40, ledger, contributorIsNew: true });
    expect(r.sharesToMint).toBe(100); // capped from 400 to 100
    expect(r.newLedger.total_shares).toBe(2500);
    expect(r.floorHit).toBe(true);
  });

  it("yields 0 if already at floor", () => {
    const ledger = baseLedger({ total_shares: 2500 });
    const r = mintContributionShares({ score: 40, ledger, contributorIsNew: true });
    expect(r.sharesToMint).toBe(0);
    expect(r.floorHit).toBe(true);
    expect(r.newLedger.contributor_count).toBe(0);
  });

  it("returning contributor doesn't re-count", () => {
    const r = mintContributionShares({ score: 25, ledger: baseLedger({ contributor_count: 3 }), contributorIsNew: false });
    expect(r.sharesToMint).toBe(250);
    expect(r.newLedger.contributor_count).toBe(3);
  });
});
