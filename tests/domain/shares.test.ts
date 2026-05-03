import { describe, expect, it } from "vitest";
import {
  deriveOwnershipBps,
  earlyMultiplierBps,
  evaluateContributionOwnership,
  type ContributorAccountState,
  type OwnershipLedgerState,
} from "@/lib/domain/shares";

const baseLedger = (override: Partial<OwnershipLedgerState> = {}): OwnershipLedgerState => ({
  author_ownership_bps: 10000,
  contributor_pool_bps: 0,
  min_author_ratio_bps: 4000,
  total_contributor_weight: 0,
  contributor_count: 0,
  points_per_100bps: 250,
  max_pool_increase_per_evaluation_bps: 500,
  ...override,
});

const baseContributor = (
  override: Partial<ContributorAccountState> = {},
): ContributorAccountState => ({
  contribution_weight: 0,
  ...override,
});

describe("earlyMultiplierBps", () => {
  it.each([
    [0, 2500],
    [1, 4000],
    [2, 4000],
    [3, 6500],
    [8, 6500],
    [9, 10000],
  ])("returns expected multiplier for contributor count %i", (count, expected) => {
    expect(earlyMultiplierBps(count)).toBe(expected);
  });
});

describe("evaluateContributionOwnership", () => {
  it("rejects scores below the approval threshold", () => {
    const ledger = baseLedger();
    const contributor = baseContributor();
    const result = evaluateContributionOwnership({ score: 19, ledger, contributor });

    expect(result.approved).toBe(false);
    expect(result.contributionWeightDelta).toBe(0);
    expect(result.ownershipDeltaBps).toBe(0);
    expect(result.newLedger).toEqual(ledger);
    expect(result.newContributor).toEqual(contributor);
  });

  it("moves the first max-score contributor into a capped contributor pool", () => {
    const result = evaluateContributionOwnership({
      score: 50,
      k: 100,
      ledger: baseLedger(),
      contributor: baseContributor(),
    });

    expect(result.contributionWeightDelta).toBe(1250);
    expect(result.ownershipDeltaBps).toBe(500);
    expect(result.newLedger).toMatchObject({
      author_ownership_bps: 9500,
      contributor_pool_bps: 500,
      total_contributor_weight: 1250,
      contributor_count: 1,
    });
    expect(result.newContributor.contribution_weight).toBe(1250);
  });

  it("moves three strong contributors in sequence while staying above the author floor", () => {
    let ledger = baseLedger();

    for (const expectedAuthorBps of [9500, 9000, 8500]) {
      const result = evaluateContributionOwnership({
        score: 50,
        k: 100,
        ledger,
        contributor: baseContributor(),
      });
      ledger = result.newLedger;
      expect(ledger.author_ownership_bps).toBe(expectedAuthorBps);
      expect(ledger.author_ownership_bps).toBeGreaterThan(ledger.min_author_ratio_bps);
    }
  });

  it("keeps the author and pool fixed at the floor while still adding contributor ownership", () => {
    const ledger = baseLedger({
      author_ownership_bps: 4000,
      contributor_pool_bps: 6000,
      total_contributor_weight: 100000,
      contributor_count: 20,
    });

    const result = evaluateContributionOwnership({
      score: 50,
      k: 100,
      ledger,
      contributor: baseContributor(),
    });

    expect(result.ownershipDeltaBps).toBeGreaterThan(0);
    expect(result.newLedger.author_ownership_bps).toBe(4000);
    expect(result.newLedger.contributor_pool_bps).toBe(6000);
  });

  it("uses target pool when the current contributor pool is above target", () => {
    const ledger = baseLedger({
      author_ownership_bps: 4000,
      contributor_pool_bps: 6000,
      total_contributor_weight: 1500,
      contributor_count: 1,
    });

    const result = evaluateContributionOwnership({
      score: 25,
      k: 50,
      ledger,
      contributor: baseContributor(),
    });
    const rows = deriveOwnershipBps({
      ledger: result.newLedger,
      contributors: [
        { holder: "bob", contributor: baseContributor({ contribution_weight: 1500 }) },
        { holder: "charlie", contributor: result.newContributor },
      ],
    });

    expect(result.newLedger.author_ownership_bps).toBe(9200);
    expect(result.newLedger.contributor_pool_bps).toBe(800);
    expect(rows).toEqual([
      { holder: "author", role: "author", ownershipBps: 9200 },
      { holder: "bob", role: "contributor", ownershipBps: 600 },
      { holder: "charlie", role: "contributor", ownershipBps: 200 },
    ]);
  });

  it("adds weight for a returning contributor without incrementing contributor count", () => {
    const result = evaluateContributionOwnership({
      score: 30,
      k: 10,
      ledger: baseLedger({
        author_ownership_bps: 9500,
        contributor_pool_bps: 500,
        total_contributor_weight: 1250,
        contributor_count: 1,
      }),
      contributor: baseContributor({ contribution_weight: 1250 }),
    });

    expect(result.contributionWeightDelta).toBe(120);
    expect(result.newLedger.contributor_count).toBe(1);
    expect(result.newContributor.contribution_weight).toBe(1370);
  });
});

describe("deriveOwnershipBps", () => {
  it("returns author ownership when there are no contributor weights", () => {
    expect(deriveOwnershipBps({ ledger: baseLedger(), contributors: [] })).toEqual([
      { holder: "author", role: "author", ownershipBps: 10000 },
    ]);
  });

  it("floors contributor ownership and assigns remainder to the largest earliest row", () => {
    const rows = deriveOwnershipBps({
      ledger: baseLedger({
        author_ownership_bps: 4000,
        contributor_pool_bps: 6000,
        total_contributor_weight: 3,
      }),
      contributors: [
        { holder: "a", contributor: baseContributor({ contribution_weight: 1 }) },
        { holder: "b", contributor: baseContributor({ contribution_weight: 1 }) },
        { holder: "c", contributor: baseContributor({ contribution_weight: 1 }) },
      ],
    });

    expect(rows.reduce((sum, row) => sum + row.ownershipBps, 0)).toBe(10000);
    expect(rows).toEqual([
      { holder: "author", role: "author", ownershipBps: 4000 },
      { holder: "a", role: "contributor", ownershipBps: 2000 },
      { holder: "b", role: "contributor", ownershipBps: 2000 },
      { holder: "c", role: "contributor", ownershipBps: 2000 },
    ]);
  });
});
