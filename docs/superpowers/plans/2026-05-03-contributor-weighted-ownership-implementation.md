# Contributor-Weighted Ownership Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw share minting with contributor-weighted ownership while keeping the user-facing product language as direct ownership percentages.

**Architecture:** The chain and TypeScript domain layer will store internal contributor weight, derive author/contributor ownership in basis points, and settle revenue from those derived percentages. The API will expose `ownershipBps`, `ownershipPct`, and `ownershipDeltaBps`; UI surfaces will remove raw "minted shares" language.

**Tech Stack:** Solana Anchor Rust program, Next.js App Router, TypeScript, SQLite via `better-sqlite3`, Vitest, Anchor tests.

---

## File Structure

- Modify `lib/domain/thresholds.ts`: add default ownership model constants.
- Replace `lib/domain/shares.ts`: implement contributor-weighted evaluation and ownership derivation.
- Modify `tests/domain/shares.test.ts`: cover rejection, early dampening, floor behavior, returning contributors, and derived percentages.
- Replace the claim math in `lib/domain/revenue.ts`: distribute revenue by author ownership and contributor weights.
- Modify `tests/domain/revenue.test.ts`: cover author claim, contributor pool, floor settlement, zero contributors, and deterministic remainders.
- Modify `programs/slp/src/math.rs`: mirror the TypeScript ownership and settlement math in pure Rust.
- Modify `programs/slp/src/constants.rs`: add default ownership constants.
- Modify `programs/slp/src/state/shares.rs`: replace raw shares with ownership/weight fields.
- Modify `programs/slp/src/state/experience.rs`: replace `shares_minted` with `contribution_weight_delta` and `ownership_delta_bps`.
- Modify `programs/slp/src/events.rs`: remove `SharesMinted`; update `ExperienceEvaluated` and `PeriodSettled` fields.
- Modify `programs/slp/src/instructions/publish_skill.rs`: initialize the new ledger and share account fields.
- Modify `programs/slp/src/instructions/subscribe.rs` and `submit_experience.rs`: initialize `contribution_weight = 0`.
- Modify `programs/slp/src/instructions/evaluate_experience.rs`: apply the new evaluation algorithm.
- Modify `programs/slp/src/instructions/settle_period.rs`: settle by derived ownership instead of raw shares.
- Regenerate `lib/chain/idl-slp.json` and `lib/chain/slp.ts` after Anchor changes.
- Modify `lib/chain/events.ts`: update supported event names and decoded fields.
- Modify `lib/db.ts`: replace SQLite raw share columns with ownership/weight columns.
- Modify `lib/indexer.ts`: project the new events and new ledger/share schema.
- Modify `lib/seed/demo.ts`: seed ownership percentages instead of raw minted shares.
- Modify API routes under `app/api/skills`, `app/api/shares`, `app/api/me`, `app/api/experiences`, `app/api/revenue`, and `app/api/indexer/status`: return derived ownership fields.
- Modify UI pages `app/console/page.tsx`, `app/skill/[id]/page.tsx`, `app/me/page.tsx`, `app/page.tsx`, and `app/deck/page.tsx`: show ownership percentages and deltas, not raw share counts.
- Update chain, indexer, API, and UI tests that currently assert `sharesMinted`, `totalShares`, or `authorShares`.

## Naming Decisions

Use these names consistently:

```ts
authorOwnershipBps
contributorPoolBps
totalContributorWeight
contributionWeight
contributionWeightDelta
ownershipDeltaBps
```

Rust account fields use snake case:

```rust
author_ownership_bps
contributor_pool_bps
total_contributor_weight
contribution_weight
contribution_weight_delta
ownership_delta_bps
```

The API may expose ownership in bps and percent, but the UI should only show user-facing ownership percentages.

---

### Task 1: TypeScript Ownership Domain Model

**Files:**
- Modify: `lib/domain/thresholds.ts`
- Replace: `lib/domain/shares.ts`
- Replace: `tests/domain/shares.test.ts`

- [ ] **Step 1: Write the failing ownership-domain tests**

Replace `tests/domain/shares.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import {
  deriveOwnershipBps,
  evaluateContributionOwnership,
  earlyMultiplierBps,
  type ContributorAccountState,
  type OwnershipLedgerState,
} from "@/lib/domain/shares";

const baseLedger = (overrides: Partial<OwnershipLedgerState> = {}): OwnershipLedgerState => ({
  author_ownership_bps: 10_000,
  contributor_pool_bps: 0,
  min_author_ratio_bps: 4_000,
  total_contributor_weight: 0,
  contributor_count: 0,
  points_per_100bps: 250,
  max_pool_increase_per_evaluation_bps: 500,
  ...overrides,
});

const contributor = (overrides: Partial<ContributorAccountState> = {}): ContributorAccountState => ({
  contribution_weight: 0,
  ...overrides,
});

describe("earlyMultiplierBps", () => {
  it("dampens early contributors by current nonzero contributor count", () => {
    expect(earlyMultiplierBps(0)).toBe(2_500);
    expect(earlyMultiplierBps(1)).toBe(4_000);
    expect(earlyMultiplierBps(2)).toBe(4_000);
    expect(earlyMultiplierBps(3)).toBe(6_500);
    expect(earlyMultiplierBps(8)).toBe(6_500);
    expect(earlyMultiplierBps(9)).toBe(10_000);
  });
});

describe("evaluateContributionOwnership", () => {
  it("rejects score below threshold without changing ownership", () => {
    const result = evaluateContributionOwnership({
      score: 19,
      k: 100,
      ledger: baseLedger(),
      contributor: contributor(),
    });

    expect(result.approved).toBe(false);
    expect(result.contributionWeightDelta).toBe(0);
    expect(result.ownershipDeltaBps).toBe(0);
    expect(result.newLedger).toEqual(baseLedger());
    expect(result.newContributor).toEqual(contributor());
  });

  it("gives the first max-score contributor 5 percent with default dampening", () => {
    const result = evaluateContributionOwnership({
      score: 50,
      k: 100,
      ledger: baseLedger(),
      contributor: contributor(),
    });

    expect(result.approved).toBe(true);
    expect(result.contributionWeightDelta).toBe(1_250);
    expect(result.ownershipDeltaBps).toBe(500);
    expect(result.newLedger.author_ownership_bps).toBe(9_500);
    expect(result.newLedger.contributor_pool_bps).toBe(500);
    expect(result.newLedger.total_contributor_weight).toBe(1_250);
    expect(result.newLedger.contributor_count).toBe(1);
    expect(result.newContributor.contribution_weight).toBe(1_250);
  });

  it("moves the author down gradually across multiple strong contributors", () => {
    const first = evaluateContributionOwnership({
      score: 50,
      k: 100,
      ledger: baseLedger(),
      contributor: contributor(),
    });
    const second = evaluateContributionOwnership({
      score: 50,
      k: 100,
      ledger: first.newLedger,
      contributor: contributor(),
    });
    const third = evaluateContributionOwnership({
      score: 50,
      k: 100,
      ledger: second.newLedger,
      contributor: contributor(),
    });

    expect(first.newLedger.author_ownership_bps).toBe(9_500);
    expect(second.newLedger.author_ownership_bps).toBe(9_000);
    expect(third.newLedger.author_ownership_bps).toBe(8_500);
    expect(third.newLedger.author_ownership_bps).toBeGreaterThan(4_000);
  });

  it("never dilutes the author below floor", () => {
    const result = evaluateContributionOwnership({
      score: 50,
      k: 100,
      ledger: baseLedger({
        author_ownership_bps: 4_000,
        contributor_pool_bps: 6_000,
        total_contributor_weight: 100_000,
        contributor_count: 20,
      }),
      contributor: contributor(),
    });

    expect(result.newLedger.author_ownership_bps).toBe(4_000);
    expect(result.newLedger.contributor_pool_bps).toBe(6_000);
    expect(result.ownershipDeltaBps).toBeGreaterThan(0);
  });

  it("at floor, a new contributor dilutes existing contributors only", () => {
    const ledger = baseLedger({
      author_ownership_bps: 4_000,
      contributor_pool_bps: 6_000,
      total_contributor_weight: 1_500,
      contributor_count: 1,
    });
    const result = evaluateContributionOwnership({
      score: 25,
      k: 50,
      ledger,
      contributor: contributor(),
    });
    const ownership = deriveOwnershipBps({
      ledger: result.newLedger,
      contributors: [
        { holder: "bob", contribution_weight: 1_500 },
        { holder: "charlie", contribution_weight: result.newContributor.contribution_weight },
      ],
    });

    expect(result.newLedger.author_ownership_bps).toBe(4_000);
    expect(ownership.find((r) => r.holder === "author")?.ownershipBps).toBe(4_000);
    expect(ownership.find((r) => r.holder === "bob")?.ownershipBps).toBe(4_500);
    expect(ownership.find((r) => r.holder === "charlie")?.ownershipBps).toBe(1_500);
  });

  it("returning contributors add weight without incrementing contributor count", () => {
    const result = evaluateContributionOwnership({
      score: 30,
      k: 10,
      ledger: baseLedger({ contributor_count: 1, total_contributor_weight: 1_250, contributor_pool_bps: 500, author_ownership_bps: 9_500 }),
      contributor: contributor({ contribution_weight: 1_250 }),
    });

    expect(result.contributionWeightDelta).toBe(120);
    expect(result.newLedger.contributor_count).toBe(1);
    expect(result.newContributor.contribution_weight).toBe(1_370);
  });
});

describe("deriveOwnershipBps", () => {
  it("gives author 100 percent when there are no contributor weights", () => {
    const rows = deriveOwnershipBps({ ledger: baseLedger(), contributors: [] });

    expect(rows).toEqual([{ holder: "author", role: "author", ownershipBps: 10_000 }]);
  });

  it("assigns deterministic remainder to the largest contributor", () => {
    const rows = deriveOwnershipBps({
      ledger: baseLedger({
        author_ownership_bps: 4_000,
        contributor_pool_bps: 6_000,
        total_contributor_weight: 3,
        contributor_count: 3,
      }),
      contributors: [
        { holder: "a", contribution_weight: 1 },
        { holder: "b", contribution_weight: 1 },
        { holder: "c", contribution_weight: 1 },
      ],
    });

    expect(rows.reduce((sum, row) => sum + row.ownershipBps, 0)).toBe(10_000);
    expect(rows.find((r) => r.holder === "a")?.ownershipBps).toBe(2_000);
    expect(rows.find((r) => r.holder === "b")?.ownershipBps).toBe(2_000);
    expect(rows.find((r) => r.holder === "c")?.ownershipBps).toBe(2_000);
  });
});
```

- [ ] **Step 2: Run the failing domain tests**

Run:

```bash
pnpm vitest run tests/domain/shares.test.ts
```

Expected: FAIL with missing exports such as `evaluateContributionOwnership`.

- [ ] **Step 3: Add the ownership constants**

Modify `lib/domain/thresholds.ts` to include:

```ts
export const K_DEFAULT = 10;
export const MIN_APPROVE_SCORE = 20;
export const MAX_SCORE = 50;
export const HARD_FLOOR_BPS = 3000; // 30% author's hard floor
export const INITIAL_TOTAL_SHARES = 1000;
export const OWNERSHIP_BPS = 10_000;
export const POINTS_PER_100BPS_DEFAULT = 250;
export const MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT = 500;
export const LAMPORTS_PER_SOL = 1_000_000_000;
export const LOCK_PERIOD_SECONDS = 60 * 60 * 24 * 180; // 6 months
```

- [ ] **Step 4: Replace the TypeScript ownership implementation**

Replace `lib/domain/shares.ts` with:

```ts
import {
  K_DEFAULT,
  MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT,
  MIN_APPROVE_SCORE,
  OWNERSHIP_BPS,
  POINTS_PER_100BPS_DEFAULT,
} from "./thresholds";

export interface OwnershipLedgerState {
  author_ownership_bps: number;
  contributor_pool_bps: number;
  min_author_ratio_bps: number;
  total_contributor_weight: number;
  contributor_count: number;
  points_per_100bps: number;
  max_pool_increase_per_evaluation_bps: number;
}

export interface ContributorAccountState {
  contribution_weight: number;
}

export interface EvaluationInput {
  score: number;
  k?: number;
  ledger: OwnershipLedgerState;
  contributor: ContributorAccountState;
}

export interface EvaluationResult {
  approved: boolean;
  contributionWeightDelta: number;
  ownershipDeltaBps: number;
  newLedger: OwnershipLedgerState;
  newContributor: ContributorAccountState;
}

export interface ContributorOwnershipInput {
  holder: string;
  contribution_weight: number;
}

export interface OwnershipRow {
  holder: string;
  role: "author" | "contributor";
  ownershipBps: number;
}

export function initialOwnershipLedger(minAuthorRatioBps: number): OwnershipLedgerState {
  return {
    author_ownership_bps: OWNERSHIP_BPS,
    contributor_pool_bps: 0,
    min_author_ratio_bps: minAuthorRatioBps,
    total_contributor_weight: 0,
    contributor_count: 0,
    points_per_100bps: POINTS_PER_100BPS_DEFAULT,
    max_pool_increase_per_evaluation_bps: MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT,
  };
}

export function earlyMultiplierBps(currentNonzeroContributorCount: number): number {
  if (currentNonzeroContributorCount <= 0) return 2_500;
  if (currentNonzeroContributorCount <= 2) return 4_000;
  if (currentNonzeroContributorCount <= 8) return 6_500;
  return 10_000;
}

export function evaluateContributionOwnership({
  score,
  k = K_DEFAULT,
  ledger,
  contributor,
}: EvaluationInput): EvaluationResult {
  if (score < MIN_APPROVE_SCORE) {
    return {
      approved: false,
      contributionWeightDelta: 0,
      ownershipDeltaBps: 0,
      newLedger: ledger,
      newContributor: contributor,
    };
  }

  const rawWeight = score * k;
  const multiplier = earlyMultiplierBps(ledger.contributor_count);
  const contributionWeightDelta = Math.floor((rawWeight * multiplier) / OWNERSHIP_BPS);
  const oldContributorOwnership = contributorOwnershipBps(ledger, contributor.contribution_weight);
  const newTotalContributorWeight = ledger.total_contributor_weight + contributionWeightDelta;
  const maxPoolBps = OWNERSHIP_BPS - ledger.min_author_ratio_bps;
  const pointsPer100Bps = ledger.points_per_100bps || POINTS_PER_100BPS_DEFAULT;
  const targetPoolBps = Math.min(maxPoolBps, Math.floor(newTotalContributorWeight / pointsPer100Bps) * 100);
  const newContributorPoolBps = Math.min(
    targetPoolBps,
    ledger.contributor_pool_bps + ledger.max_pool_increase_per_evaluation_bps,
  );
  const wasZero = contributor.contribution_weight === 0;
  const newLedger: OwnershipLedgerState = {
    ...ledger,
    author_ownership_bps: OWNERSHIP_BPS - newContributorPoolBps,
    contributor_pool_bps: newContributorPoolBps,
    total_contributor_weight: newTotalContributorWeight,
    contributor_count: ledger.contributor_count + (wasZero && contributionWeightDelta > 0 ? 1 : 0),
  };
  const newContributor: ContributorAccountState = {
    contribution_weight: contributor.contribution_weight + contributionWeightDelta,
  };
  const newContributorOwnership = contributorOwnershipBps(newLedger, newContributor.contribution_weight);

  return {
    approved: true,
    contributionWeightDelta,
    ownershipDeltaBps: Math.max(0, newContributorOwnership - oldContributorOwnership),
    newLedger,
    newContributor,
  };
}

export function contributorOwnershipBps(ledger: OwnershipLedgerState, contributionWeight: number): number {
  if (ledger.total_contributor_weight <= 0 || contributionWeight <= 0) return 0;
  return Math.floor((ledger.contributor_pool_bps * contributionWeight) / ledger.total_contributor_weight);
}

export function deriveOwnershipBps({
  ledger,
  contributors,
}: {
  ledger: OwnershipLedgerState;
  contributors: ContributorOwnershipInput[];
}): OwnershipRow[] {
  const nonzero = contributors.filter((c) => c.contribution_weight > 0);
  if (ledger.total_contributor_weight <= 0 || nonzero.length === 0) {
    return [{ holder: "author", role: "author", ownershipBps: OWNERSHIP_BPS }];
  }

  const rows: OwnershipRow[] = [
    { holder: "author", role: "author", ownershipBps: ledger.author_ownership_bps },
    ...nonzero.map((c) => ({
      holder: c.holder,
      role: "contributor" as const,
      ownershipBps: Math.floor((ledger.contributor_pool_bps * c.contribution_weight) / ledger.total_contributor_weight),
    })),
  ];
  const distributed = rows.reduce((sum, row) => sum + row.ownershipBps, 0);
  const remainder = OWNERSHIP_BPS - distributed;
  if (remainder > 0) {
    const targetIndex = largestOwnershipIndex(rows);
    rows[targetIndex] = { ...rows[targetIndex], ownershipBps: rows[targetIndex].ownershipBps + remainder };
  }
  return rows;
}

function largestOwnershipIndex(rows: OwnershipRow[]): number {
  let best = 0;
  for (let i = 1; i < rows.length; i += 1) {
    if (rows[i].ownershipBps > rows[best].ownershipBps) best = i;
  }
  return best;
}
```

- [ ] **Step 5: Run the ownership-domain tests**

Run:

```bash
pnpm vitest run tests/domain/shares.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/domain/thresholds.ts lib/domain/shares.ts tests/domain/shares.test.ts
git commit -m "Implement contributor-weighted ownership math"
```

---

### Task 2: TypeScript Revenue Domain Model

**Files:**
- Replace: `lib/domain/revenue.ts`
- Replace: `tests/domain/revenue.test.ts`

- [ ] **Step 1: Write the failing revenue-domain tests**

Replace `tests/domain/revenue.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { computeOwnershipClaims, settlePeriod } from "@/lib/domain/revenue";

const pool = {
  current_period_revenue: 1000,
  total_lifetime_revenue: 0,
  current_period_start: 100,
  period_length: 300,
  snapshot_author_ownership_bps: 0,
  snapshot_contributor_pool_bps: 0,
  last_settlement_time: 0,
};

describe("settlePeriod", () => {
  it("settles elapsed period with ownership snapshots", () => {
    const result = settlePeriod({
      pool,
      authorOwnershipBps: 9500,
      contributorPoolBps: 500,
      now: 500,
    });

    expect(result.canSettle).toBe(true);
    expect(result.periodRevenue).toBe(1000);
    expect(result.newPool.snapshot_author_ownership_bps).toBe(9500);
    expect(result.newPool.snapshot_contributor_pool_bps).toBe(500);
  });

  it("refuses to settle before period elapsed", () => {
    const result = settlePeriod({
      pool,
      authorOwnershipBps: 9500,
      contributorPoolBps: 500,
      now: 399,
    });

    expect(result.canSettle).toBe(false);
    expect(result.reason).toBe("period_not_elapsed");
  });
});

describe("computeOwnershipClaims", () => {
  it("pays the author 100 percent when there are no contributor weights", () => {
    const claims = computeOwnershipClaims({
      holders: [{ holder: "author", role: "author", contributionWeight: 0 }],
      periodRevenue: 1000,
      authorOwnershipBps: 10000,
      contributorPoolBps: 0,
      totalContributorWeight: 0,
    });

    expect(claims).toEqual([{ holder: "author", amount: 1000 }]);
  });

  it("splits author and contributor pool revenue", () => {
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

    expect(claims).toEqual([
      { holder: "author", amount: 400 },
      { holder: "bob", amount: 450 },
      { holder: "charlie", amount: 150 },
    ]);
  });

  it("assigns lamport remainder deterministically to largest effective holder", () => {
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

    expect(claims.reduce((sum, c) => sum + c.amount, 0)).toBe(101);
    expect(claims.find((c) => c.holder === "author")?.amount).toBe(41);
    expect(claims.find((c) => c.holder === "bob")?.amount).toBe(30);
    expect(claims.find((c) => c.holder === "charlie")?.amount).toBe(30);
  });
});
```

- [ ] **Step 2: Run the failing revenue-domain tests**

Run:

```bash
pnpm vitest run tests/domain/revenue.test.ts
```

Expected: FAIL with missing `computeOwnershipClaims` or old field names.

- [ ] **Step 3: Replace the revenue-domain implementation**

Replace `lib/domain/revenue.ts` with:

```ts
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

export function settlePeriod({ pool, authorOwnershipBps, contributorPoolBps, now }: SettleInput): SettleResult {
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

export interface Claim {
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
}): Claim[] {
  if (periodRevenue <= 0) return holders.map((h) => ({ holder: h.holder, amount: 0 }));

  const claims = holders.map((h) => {
    if (h.role === "author") {
      return { holder: h.holder, amount: Math.floor((periodRevenue * authorOwnershipBps) / OWNERSHIP_BPS) };
    }
    if (totalContributorWeight <= 0 || contributorPoolBps <= 0 || h.contributionWeight <= 0) {
      return { holder: h.holder, amount: 0 };
    }
    const contributorRevenue = Math.floor((periodRevenue * contributorPoolBps) / OWNERSHIP_BPS);
    return { holder: h.holder, amount: Math.floor((contributorRevenue * h.contributionWeight) / totalContributorWeight) };
  });

  const distributed = claims.reduce((sum, c) => sum + c.amount, 0);
  const remainder = periodRevenue - distributed;
  if (remainder > 0 && claims.length > 0) {
    const target = largestEffectiveHolderIndex(holders, authorOwnershipBps, contributorPoolBps, totalContributorWeight);
    claims[target] = { ...claims[target], amount: claims[target].amount + remainder };
  }
  return claims;
}

function largestEffectiveHolderIndex(
  holders: OwnershipHolder[],
  authorOwnershipBps: number,
  contributorPoolBps: number,
  totalContributorWeight: number,
): number {
  let best = 0;
  let bestBps = -1;
  holders.forEach((h, i) => {
    const bps =
      h.role === "author"
        ? authorOwnershipBps
        : totalContributorWeight > 0
        ? Math.floor((contributorPoolBps * h.contributionWeight) / totalContributorWeight)
        : 0;
    if (bps > bestBps) {
      best = i;
      bestBps = bps;
    }
  });
  return best;
}
```

- [ ] **Step 4: Run the revenue-domain tests**

Run:

```bash
pnpm vitest run tests/domain/revenue.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/domain/revenue.ts tests/domain/revenue.test.ts
git commit -m "Update revenue math for ownership percentages"
```

---

### Task 3: Rust Pure Math

**Files:**
- Modify: `programs/slp/src/constants.rs`
- Replace ownership-related portions of: `programs/slp/src/math.rs`

- [ ] **Step 1: Write failing Rust math tests**

In `programs/slp/src/math.rs`, replace the old `mint_contribution_shares` tests with tests named:

```rust
#[test]
fn first_max_score_contributor_gets_five_percent() {
    let out = evaluate_contribution_ownership(EvaluateOwnershipInput {
        score: 50,
        k: 100,
        author_ownership_bps: 10_000,
        contributor_pool_bps: 0,
        min_author_ratio_bps: 4_000,
        total_contributor_weight: 0,
        contributor_count: 0,
        contributor_weight: 0,
        points_per_100bps: 250,
        max_pool_increase_per_evaluation_bps: 500,
    });
    assert_eq!(out.contribution_weight_delta, 1_250);
    assert_eq!(out.ownership_delta_bps, 500);
    assert_eq!(out.author_ownership_bps, 9_500);
    assert_eq!(out.contributor_pool_bps, 500);
    assert_eq!(out.total_contributor_weight, 1_250);
    assert_eq!(out.contributor_count, 1);
}

#[test]
fn floor_stops_author_dilution_but_allows_new_weight() {
    let out = evaluate_contribution_ownership(EvaluateOwnershipInput {
        score: 50,
        k: 100,
        author_ownership_bps: 4_000,
        contributor_pool_bps: 6_000,
        min_author_ratio_bps: 4_000,
        total_contributor_weight: 1_500,
        contributor_count: 1,
        contributor_weight: 0,
        points_per_100bps: 250,
        max_pool_increase_per_evaluation_bps: 500,
    });
    assert_eq!(out.author_ownership_bps, 4_000);
    assert_eq!(out.contributor_pool_bps, 6_000);
    assert!(out.contribution_weight_delta > 0);
    assert!(out.ownership_delta_bps > 0);
}
```

Also add a claim test:

```rust
#[test]
fn ownership_claims_split_author_and_contributors() {
    let holders = [
        OwnershipHolder { contribution_weight: 0, index: 0, is_author: true },
        OwnershipHolder { contribution_weight: 1_500, index: 1, is_author: false },
        OwnershipHolder { contribution_weight: 500, index: 2, is_author: false },
    ];
    let claims = compute_ownership_claims(&holders, 1_000, 4_000, 6_000, 2_000);
    assert_eq!(claims[0].amount, 400);
    assert_eq!(claims[1].amount, 450);
    assert_eq!(claims[2].amount, 150);
}
```

- [ ] **Step 2: Run failing Rust math tests**

Run:

```bash
cd programs && anchor test --skip-local-validator --skip-deploy
```

Expected: FAIL with missing `evaluate_contribution_ownership` and `compute_ownership_claims`.

- [ ] **Step 3: Add Rust constants**

Modify `programs/slp/src/constants.rs` so it contains these ownership constants:

```rust
pub const OWNERSHIP_BPS: u16 = 10_000;
pub const POINTS_PER_100BPS_DEFAULT: u64 = 250;
pub const MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT: u16 = 500;
```

Keep existing threshold, `k`, lock, string-length, and status constants.

- [ ] **Step 4: Replace Rust ownership math**

In `programs/slp/src/math.rs`, replace `MintInput`, `MintOutput`, and `mint_contribution_shares` with:

```rust
#[derive(Clone, Copy, Debug)]
pub struct EvaluateOwnershipInput {
    pub score: u8,
    pub k: u16,
    pub author_ownership_bps: u16,
    pub contributor_pool_bps: u16,
    pub min_author_ratio_bps: u16,
    pub total_contributor_weight: u64,
    pub contributor_count: u32,
    pub contributor_weight: u64,
    pub points_per_100bps: u64,
    pub max_pool_increase_per_evaluation_bps: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EvaluateOwnershipOutput {
    pub contribution_weight_delta: u64,
    pub ownership_delta_bps: u16,
    pub author_ownership_bps: u16,
    pub contributor_pool_bps: u16,
    pub total_contributor_weight: u64,
    pub contributor_count: u32,
}

pub fn early_multiplier_bps(current_nonzero_contributor_count: u32) -> u16 {
    if current_nonzero_contributor_count == 0 {
        2_500
    } else if current_nonzero_contributor_count <= 2 {
        4_000
    } else if current_nonzero_contributor_count <= 8 {
        6_500
    } else {
        10_000
    }
}

pub fn evaluate_contribution_ownership(i: EvaluateOwnershipInput) -> EvaluateOwnershipOutput {
    let raw_weight = (i.score as u64).saturating_mul(i.k as u64);
    let contribution_weight_delta = raw_weight
        .saturating_mul(early_multiplier_bps(i.contributor_count) as u64)
        / 10_000u64;
    let old_ownership = contributor_ownership_bps(
        i.contributor_pool_bps,
        i.contributor_weight,
        i.total_contributor_weight,
    );
    let total_contributor_weight = i.total_contributor_weight.saturating_add(contribution_weight_delta);
    let max_pool_bps = 10_000u16.saturating_sub(i.min_author_ratio_bps);
    let target_pool_bps_u64 = total_contributor_weight
        .checked_div(i.points_per_100bps.max(1))
        .unwrap_or(0)
        .saturating_mul(100)
        .min(max_pool_bps as u64);
    let target_pool_bps = target_pool_bps_u64 as u16;
    let contributor_pool_bps = target_pool_bps.min(
        i.contributor_pool_bps
            .saturating_add(i.max_pool_increase_per_evaluation_bps),
    );
    let new_contributor_weight = i.contributor_weight.saturating_add(contribution_weight_delta);
    let new_ownership = contributor_ownership_bps(
        contributor_pool_bps,
        new_contributor_weight,
        total_contributor_weight,
    );
    let contributor_count = if i.contributor_weight == 0 && contribution_weight_delta > 0 {
        i.contributor_count.saturating_add(1)
    } else {
        i.contributor_count
    };

    EvaluateOwnershipOutput {
        contribution_weight_delta,
        ownership_delta_bps: new_ownership.saturating_sub(old_ownership),
        author_ownership_bps: 10_000u16.saturating_sub(contributor_pool_bps),
        contributor_pool_bps,
        total_contributor_weight,
        contributor_count,
    }
}

pub fn contributor_ownership_bps(
    contributor_pool_bps: u16,
    contribution_weight: u64,
    total_contributor_weight: u64,
) -> u16 {
    if total_contributor_weight == 0 || contribution_weight == 0 {
        return 0;
    }
    ((contributor_pool_bps as u128)
        .saturating_mul(contribution_weight as u128)
        / (total_contributor_weight as u128)) as u16
}
```

Replace `Holder` with:

```rust
#[derive(Clone, Copy, Debug)]
pub struct OwnershipHolder {
    pub contribution_weight: u64,
    pub index: usize,
    pub is_author: bool,
}
```

Replace `compute_claims` with:

```rust
pub fn compute_ownership_claims(
    holders: &[OwnershipHolder],
    period_revenue: u64,
    author_ownership_bps: u16,
    contributor_pool_bps: u16,
    total_contributor_weight: u64,
) -> Vec<Claim> {
    if holders.is_empty() {
        return Vec::new();
    }
    if period_revenue == 0 {
        return holders.iter().map(|h| Claim { index: h.index, amount: 0 }).collect();
    }

    let contributor_revenue =
        ((period_revenue as u128) * (contributor_pool_bps as u128) / 10_000u128) as u64;
    let mut claims: Vec<Claim> = holders
        .iter()
        .map(|h| {
            let amount = if h.is_author {
                ((period_revenue as u128) * (author_ownership_bps as u128) / 10_000u128) as u64
            } else if total_contributor_weight == 0 || h.contribution_weight == 0 {
                0
            } else {
                ((contributor_revenue as u128) * (h.contribution_weight as u128)
                    / (total_contributor_weight as u128)) as u64
            };
            Claim { index: h.index, amount }
        })
        .collect();

    let distributed: u64 = claims.iter().map(|c| c.amount).sum();
    let remainder = period_revenue.saturating_sub(distributed);
    if remainder > 0 {
        let best = largest_effective_holder_index(
            holders,
            author_ownership_bps,
            contributor_pool_bps,
            total_contributor_weight,
        );
        claims[best].amount = claims[best].amount.saturating_add(remainder);
    }
    claims
}

fn largest_effective_holder_index(
    holders: &[OwnershipHolder],
    author_ownership_bps: u16,
    contributor_pool_bps: u16,
    total_contributor_weight: u64,
) -> usize {
    let mut best_pos = 0usize;
    let mut best_bps = 0u16;
    for (pos, h) in holders.iter().enumerate() {
        let bps = if h.is_author {
            author_ownership_bps
        } else {
            contributor_ownership_bps(
                contributor_pool_bps,
                h.contribution_weight,
                total_contributor_weight,
            )
        };
        if pos == 0 || bps > best_bps {
            best_pos = pos;
            best_bps = bps;
        }
    }
    best_pos
}
```

- [ ] **Step 5: Run Rust math tests**

Run:

```bash
cd programs && anchor test --skip-local-validator --skip-deploy
```

Expected: old instruction tests may still fail, but pure math tests should compile. If compile errors are caused by old instruction imports of `MintInput`, continue to Task 4 before rerunning.

- [ ] **Step 6: Commit**

Run after Task 4 if Task 3 cannot compile independently:

```bash
git add programs/slp/src/constants.rs programs/slp/src/math.rs
git commit -m "Add Rust ownership math"
```

---

### Task 4: Anchor Program State, Events, and Instructions

**Files:**
- Modify: `programs/slp/src/state/shares.rs`
- Modify: `programs/slp/src/state/experience.rs`
- Modify: `programs/slp/src/state/revenue.rs`
- Modify: `programs/slp/src/events.rs`
- Modify: `programs/slp/src/instructions/publish_skill.rs`
- Modify: `programs/slp/src/instructions/subscribe.rs`
- Modify: `programs/slp/src/instructions/submit_experience.rs`
- Modify: `programs/slp/src/instructions/evaluate_experience.rs`
- Modify: `programs/slp/src/instructions/settle_period.rs`
- Modify: `programs/slp/tests/golden_flow.rs`
- Modify: `programs/slp/tests/adversarial.rs`

- [ ] **Step 1: Update state structs**

Change `programs/slp/src/state/shares.rs` to:

```rust
use anchor_lang::prelude::*;

#[account]
pub struct ShareLedger {
    pub skill: Pubkey,
    pub author_ownership_bps: u16,
    pub contributor_pool_bps: u16,
    pub min_author_ratio_bps: u16,
    pub total_contributor_weight: u64,
    pub contributor_count: u32,
    pub points_per_100bps: u64,
    pub max_pool_increase_per_evaluation_bps: u16,
    pub last_snapshot_time: i64,
    pub bump: u8,
}

impl ShareLedger {
    pub const SPACE: usize = 8 + 32 + 2 + 2 + 2 + 8 + 4 + 8 + 2 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"ledger";
}

#[account]
pub struct ShareAccount {
    pub holder: Pubkey,
    pub skill: Pubkey,
    pub contribution_weight: u64,
    pub lock_until: i64,
    pub first_contribution_at: i64,
    pub last_contribution_at: i64,
    pub bump: u8,
}

impl ShareAccount {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"share";
}
```

In `programs/slp/src/state/experience.rs`, replace `shares_minted: u64` with:

```rust
pub contribution_weight_delta: u64,
pub ownership_delta_bps: u16,
```

Adjust `ExperienceRecord::SPACE` by replacing the old `+ 8` for `shares_minted` with `+ 8 + 2`.

In `programs/slp/src/state/revenue.rs`, replace `snapshot_total_shares` with:

```rust
pub snapshot_author_ownership_bps: u16,
pub snapshot_contributor_pool_bps: u16,
```

Adjust `RevenuePool::SPACE` by replacing the old `+ 8` snapshot field with `+ 2 + 2`.

- [ ] **Step 2: Update events**

Modify `programs/slp/src/events.rs`:

```rust
#[event]
pub struct ExperienceEvaluated {
    pub skill: Pubkey,
    pub experience_id: u64,
    pub contributor: Pubkey,
    pub score: u8,
    pub contribution_weight_delta: u64,
    pub ownership_delta_bps: u16,
    pub author_ownership_bps: u16,
    pub contributor_pool_bps: u16,
    pub approved: bool,
}

#[event]
pub struct PeriodSettled {
    pub skill: Pubkey,
    pub snapshot_id: u64,
    pub period_revenue: u64,
    pub author_ownership_bps: u16,
    pub contributor_pool_bps: u16,
}
```

Delete the `SharesMinted` event struct.

- [ ] **Step 3: Initialize state in publish and create-account paths**

In `publish_skill.rs`, initialize the ledger as:

```rust
ledger.skill = skill.key();
ledger.author_ownership_bps = OWNERSHIP_BPS;
ledger.contributor_pool_bps = 0;
ledger.min_author_ratio_bps = args.min_author_ratio_bps;
ledger.total_contributor_weight = 0;
ledger.contributor_count = 0;
ledger.points_per_100bps = POINTS_PER_100BPS_DEFAULT;
ledger.max_pool_increase_per_evaluation_bps = MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT;
ledger.last_snapshot_time = now;
ledger.bump = ctx.bumps.ledger;
```

Initialize the author share account as:

```rust
author_share.holder = ctx.accounts.author.key();
author_share.skill = skill.key();
author_share.contribution_weight = 0;
author_share.lock_until = 0;
author_share.first_contribution_at = 0;
author_share.last_contribution_at = 0;
author_share.bump = ctx.bumps.author_share;
```

Initialize revenue snapshot fields as:

```rust
pool.snapshot_author_ownership_bps = OWNERSHIP_BPS;
pool.snapshot_contributor_pool_bps = 0;
```

In `subscribe.rs` and `submit_experience.rs`, replace any `share.shares = 0` initialization with:

```rust
share.contribution_weight = 0;
share.lock_until = 0;
share.first_contribution_at = 0;
share.last_contribution_at = 0;
```

In `submit_experience.rs`, initialize:

```rust
exp.contribution_weight_delta = 0;
exp.ownership_delta_bps = 0;
```

- [ ] **Step 4: Replace evaluation instruction logic**

In `evaluate_experience.rs`, import:

```rust
math::{evaluate_contribution_ownership, EvaluateOwnershipInput},
```

For rejected scores, set:

```rust
exp.status = STATUS_REJECTED;
exp.contribution_score = score;
exp.contribution_weight_delta = 0;
exp.ownership_delta_bps = 0;
exp.evaluated_at = now;
exp.judge_report_tx_id = judge_report_tx_id;
emit!(ExperienceEvaluated {
    skill: ctx.accounts.skill.key(),
    experience_id: exp.experience_id,
    contributor: exp.contributor,
    score,
    contribution_weight_delta: 0,
    ownership_delta_bps: 0,
    author_ownership_bps: ledger.author_ownership_bps,
    contributor_pool_bps: ledger.contributor_pool_bps,
    approved: false,
});
return Ok(());
```

For approved scores, replace minting with:

```rust
let ownership = evaluate_contribution_ownership(EvaluateOwnershipInput {
    score,
    k: ctx.accounts.skill.k,
    author_ownership_bps: ledger.author_ownership_bps,
    contributor_pool_bps: ledger.contributor_pool_bps,
    min_author_ratio_bps: ledger.min_author_ratio_bps,
    total_contributor_weight: ledger.total_contributor_weight,
    contributor_count: ledger.contributor_count,
    contributor_weight: share.contribution_weight,
    points_per_100bps: ledger.points_per_100bps,
    max_pool_increase_per_evaluation_bps: ledger.max_pool_increase_per_evaluation_bps,
});

ledger.author_ownership_bps = ownership.author_ownership_bps;
ledger.contributor_pool_bps = ownership.contributor_pool_bps;
ledger.total_contributor_weight = ownership.total_contributor_weight;
ledger.contributor_count = ownership.contributor_count;
ledger.last_snapshot_time = now;

share.contribution_weight = share
    .contribution_weight
    .saturating_add(ownership.contribution_weight_delta);
if share.first_contribution_at == 0 && ownership.contribution_weight_delta > 0 {
    share.first_contribution_at = now;
}
share.last_contribution_at = now;
share.lock_until = now + LOCK_PERIOD_SECONDS;

exp.status = STATUS_EVALUATED;
exp.contribution_score = score;
exp.contribution_weight_delta = ownership.contribution_weight_delta;
exp.ownership_delta_bps = ownership.ownership_delta_bps;
exp.evaluated_at = now;
exp.judge_report_tx_id = judge_report_tx_id;

emit!(ExperienceEvaluated {
    skill: ctx.accounts.skill.key(),
    experience_id: exp.experience_id,
    contributor: exp.contributor,
    score,
    contribution_weight_delta: ownership.contribution_weight_delta,
    ownership_delta_bps: ownership.ownership_delta_bps,
    author_ownership_bps: ledger.author_ownership_bps,
    contributor_pool_bps: ledger.contributor_pool_bps,
    approved: true,
});
```

Do not emit `SharesMinted`.

- [ ] **Step 5: Replace settlement instruction logic**

In `settle_period.rs`, import:

```rust
math::{compute_ownership_claims, OwnershipHolder},
```

For zero revenue snapshots, set:

```rust
pool.snapshot_author_ownership_bps = ledger.author_ownership_bps;
pool.snapshot_contributor_pool_bps = ledger.contributor_pool_bps;
```

When reading remaining accounts, require the author share account and all nonzero contributor share accounts. Build holders with:

```rust
let is_author = share.holder == ctx.accounts.skill.author;
if !is_author {
    require!(share.contribution_weight > 0, SlpError::SharesMustBeNonzero);
    sum_contributor_weight = sum_contributor_weight
        .checked_add(share.contribution_weight)
        .ok_or(error!(SlpError::HoldersIncomplete))?;
}
holders.push(OwnershipHolder {
    contribution_weight: share.contribution_weight,
    index: i,
    is_author,
});
```

After the loop, verify:

```rust
require!(holders.iter().any(|h| h.is_author), SlpError::HoldersIncomplete);
require_eq!(
    sum_contributor_weight,
    ledger.total_contributor_weight,
    SlpError::HoldersIncomplete
);
```

Compute claims with:

```rust
let claims = compute_ownership_claims(
    &holders,
    period_revenue,
    ledger.author_ownership_bps,
    ledger.contributor_pool_bps,
    ledger.total_contributor_weight,
);
```

Emit `PeriodSettled` with:

```rust
emit!(PeriodSettled {
    skill: skill_key,
    snapshot_id: next_snapshot_id,
    period_revenue,
    author_ownership_bps: ledger.author_ownership_bps,
    contributor_pool_bps: ledger.contributor_pool_bps,
});
```

- [ ] **Step 6: Update Anchor tests**

In `programs/slp/tests/golden_flow.rs`, replace assertions like:

```rust
assert_eq!(exp.shares_minted, 380);
assert_eq!(ledger.total_shares, 1380);
```

with:

```rust
assert_eq!(exp.contribution_weight_delta, 152);
assert_eq!(exp.ownership_delta_bps, 0);
assert_eq!(ledger.total_contributor_weight, 152);
assert_eq!(ledger.author_ownership_bps, 10_000);
assert_eq!(ledger.contributor_pool_bps, 0);
```

For the existing demo `score=38, k=10`, the first dampened weight is `floor(380 * 2500 / 10000) = 95`; if the test uses `k=10`, assert `95`. If the test sets `k=16`, assert `152`. Read the fixture's actual `k` before updating.

In `programs/slp/tests/adversarial.rs`, replace the score-19 rejection assertion:

```rust
assert_eq!(exp.shares_minted, 0);
```

with:

```rust
assert_eq!(exp.contribution_weight_delta, 0);
assert_eq!(exp.ownership_delta_bps, 0);
```

Add a new floor test that evaluates a contributor when `author_ownership_bps == min_author_ratio_bps` and asserts the ledger author bps stays unchanged while contributor weight increases.

- [ ] **Step 7: Run Anchor tests**

Run:

```bash
cd programs && anchor test --skip-local-validator --skip-deploy
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add programs/slp/src programs/slp/tests
git commit -m "Update program to contributor-weighted ownership"
```

---

### Task 5: Regenerate IDL and Chain Event Types

**Files:**
- Regenerate: `lib/chain/idl-slp.json`
- Regenerate or modify: `lib/chain/slp.ts`
- Modify: `lib/chain/events.ts`
- Modify: `tests/chain/events.test.ts`
- Modify: `tests/chain/tx-sub-sub-eval.test.ts`

- [ ] **Step 1: Regenerate Anchor IDL artifacts**

Run:

```bash
cd programs && anchor build
```

Expected: PASS and regenerated IDL/type artifacts under `programs/target`.

Copy the regenerated IDL into the app location used by this repo:

```bash
cp programs/target/idl/slp.json lib/chain/idl-slp.json
```

If `lib/chain/slp.ts` is generated from `programs/target/types/slp.ts`, copy it:

```bash
cp programs/target/types/slp.ts lib/chain/slp.ts
```

- [ ] **Step 2: Update event name union**

Modify `lib/chain/events.ts` so `SlpEventName` removes `"SharesMinted"` and keeps:

```ts
export type SlpEventName =
  | "SkillPublished"
  | "Subscribed"
  | "ExperienceSubmitted"
  | "ExperienceEvaluated"
  | "PeriodSettled"
  | "RevenueClaimed"
  | "VersionPublished";
```

- [ ] **Step 3: Update event tests**

In `tests/chain/events.test.ts`, replace the `SharesMinted` test with an `ExperienceEvaluated` test that encodes:

```ts
{
  skill: SKILL,
  experienceId: 0,
  contributor: BOB,
  score: 38,
  contributionWeightDelta: 95,
  ownershipDeltaBps: 0,
  authorOwnershipBps: 10000,
  contributorPoolBps: 0,
  approved: true,
}
```

Assert:

```ts
expect(e.name).toBe("ExperienceEvaluated");
expect(e.data.contributionWeightDelta.toString()).toBe("95");
expect(e.data.ownershipDeltaBps).toBe(0);
```

- [ ] **Step 4: Update evaluate transaction tests**

In `tests/chain/tx-sub-sub-eval.test.ts`, keep the account list assertions for judge, config, skill, experience, ledger, and contributor share. Remove any assertion that expects `sharesMinted` because `evaluateExperience` still only receives score and judge report tx id.

- [ ] **Step 5: Run chain TS tests**

Run:

```bash
pnpm vitest run tests/chain/events.test.ts tests/chain/tx-sub-sub-eval.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add lib/chain/idl-slp.json lib/chain/slp.ts lib/chain/events.ts tests/chain/events.test.ts tests/chain/tx-sub-sub-eval.test.ts
git commit -m "Regenerate chain types for ownership events"
```

---

### Task 6: SQLite Schema and Indexer Projection

**Files:**
- Modify: `lib/db.ts`
- Modify: `lib/indexer.ts`
- Modify: `tests/chain/db-migrations.test.ts`
- Modify: `tests/indexer/projection.test.ts`
- Modify: `tests/indexer/tick.test.ts`

- [ ] **Step 1: Update SQLite schema**

In `lib/db.ts`, replace `share_ledgers`, `share_accounts`, `experiences`, `revenue_pools`, and `revenue_history` table definitions with:

```sql
CREATE TABLE IF NOT EXISTS share_ledgers (
  skill_id TEXT PRIMARY KEY,
  author_ownership_bps INTEGER NOT NULL,
  contributor_pool_bps INTEGER NOT NULL,
  min_author_ratio_bps INTEGER NOT NULL,
  total_contributor_weight INTEGER NOT NULL,
  contributor_count INTEGER NOT NULL,
  points_per_100bps INTEGER NOT NULL,
  max_pool_increase_per_evaluation_bps INTEGER NOT NULL,
  last_snapshot_time INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS share_accounts (
  holder TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  contribution_weight INTEGER NOT NULL DEFAULT 0,
  lock_until INTEGER NOT NULL DEFAULT 0,
  first_contribution_at INTEGER,
  last_contribution_at INTEGER,
  PRIMARY KEY (holder, skill_id)
);
CREATE TABLE IF NOT EXISTS experiences (
  experience_id INTEGER NOT NULL,
  skill_id TEXT NOT NULL,
  contributor TEXT NOT NULL,
  skill_version INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  arweave_tx_id TEXT NOT NULL,
  bundle_json TEXT NOT NULL,
  status TEXT NOT NULL,
  contribution_score INTEGER,
  contribution_weight_delta INTEGER,
  ownership_delta_bps INTEGER,
  submitted_at INTEGER NOT NULL,
  evaluated_at INTEGER,
  judge_report_tx_id TEXT,
  judge_report_json TEXT,
  PRIMARY KEY (skill_id, experience_id)
);
CREATE TABLE IF NOT EXISTS revenue_pools (
  skill_id TEXT PRIMARY KEY,
  current_period_revenue INTEGER NOT NULL DEFAULT 0,
  total_lifetime_revenue INTEGER NOT NULL DEFAULT 0,
  current_period_start INTEGER NOT NULL,
  period_length INTEGER NOT NULL,
  snapshot_author_ownership_bps INTEGER NOT NULL DEFAULT 10000,
  snapshot_contributor_pool_bps INTEGER NOT NULL DEFAULT 0,
  last_settlement_time INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS revenue_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id TEXT NOT NULL,
  period_start INTEGER NOT NULL,
  period_end INTEGER NOT NULL,
  period_revenue INTEGER NOT NULL,
  snapshot_author_ownership_bps INTEGER NOT NULL,
  snapshot_contributor_pool_bps INTEGER NOT NULL
);
```

Because the app is not live, delete `migrateExperiencesCompositeKey` and `backfillShareLedgerAuthorFloors`. Keep `migrate(db)` simple and destructive compatibility-free.

- [ ] **Step 2: Update indexer publish/subscribe/submit projection**

In `lib/indexer.ts`:

For `SkillPublished`, insert ledger fields:

```ts
db.prepare(`INSERT OR IGNORE INTO share_ledgers
  (skill_id, author_ownership_bps, contributor_pool_bps, min_author_ratio_bps, total_contributor_weight, contributor_count, points_per_100bps, max_pool_increase_per_evaluation_bps, last_snapshot_time)
  VALUES (?,10000,0,?,0,0,250,500,?)`)
  .run(skillId, Number(ev.data.minAuthorRatioBps ?? 4000), t);
```

For share account creation in subscribe and submit paths:

```ts
db.prepare(`INSERT OR IGNORE INTO share_accounts (holder, skill_id, contribution_weight, lock_until) VALUES (?,?,0,0)`)
  .run(holder, skillId);
```

For submitted experiences:

```ts
db.prepare(`INSERT OR IGNORE INTO experiences
  (experience_id, skill_id, contributor, skill_version, content_hash, arweave_tx_id, bundle_json, status, submitted_at)
  VALUES (?,?,?,1,'','', '', 'Pending', ?)`)
  .run(experienceId, skillId, contributor, t);
```

- [ ] **Step 3: Replace event projection for evaluation**

In the `ExperienceEvaluated` case:

```ts
const contributor = ev.data.contributor.toBase58();
const score = Number(ev.data.score);
const contributionWeightDelta = Number(ev.data.contributionWeightDelta);
const ownershipDeltaBps = Number(ev.data.ownershipDeltaBps);
const authorOwnershipBps = Number(ev.data.authorOwnershipBps);
const contributorPoolBps = Number(ev.data.contributorPoolBps);
const approved = Boolean(ev.data.approved);

db.prepare(`UPDATE experiences
  SET status = ?, contribution_score = ?, contribution_weight_delta = ?, ownership_delta_bps = ?, evaluated_at = ?
  WHERE skill_id = ? AND experience_id = ?`)
  .run(approved ? "Evaluated" : "Rejected", score, contributionWeightDelta, ownershipDeltaBps, t, skillId, experienceId);

db.prepare(`UPDATE share_ledgers
  SET author_ownership_bps = ?, contributor_pool_bps = ?, last_snapshot_time = ?
  WHERE skill_id = ?`)
  .run(authorOwnershipBps, contributorPoolBps, t, skillId);

if (approved && contributionWeightDelta > 0) {
  const existing = db.prepare(`SELECT contribution_weight FROM share_accounts WHERE holder=? AND skill_id=?`)
    .get(contributor, skillId) as { contribution_weight: number } | undefined;
  const wasZero = Number(existing?.contribution_weight ?? 0) === 0;
  db.prepare(`INSERT OR IGNORE INTO share_accounts (holder, skill_id, contribution_weight, lock_until) VALUES (?,?,0,0)`)
    .run(contributor, skillId);
  db.prepare(`UPDATE share_accounts
    SET contribution_weight = contribution_weight + ?,
        lock_until = ?,
        first_contribution_at = CASE WHEN first_contribution_at IS NULL THEN ? ELSE first_contribution_at END,
        last_contribution_at = ?
    WHERE holder = ? AND skill_id = ?`)
    .run(contributionWeightDelta, t + 180 * 24 * 60 * 60, t, t, contributor, skillId);
  db.prepare(`UPDATE share_ledgers
    SET total_contributor_weight = total_contributor_weight + ?,
        contributor_count = contributor_count + ?
    WHERE skill_id = ?`)
    .run(contributionWeightDelta, wasZero ? 1 : 0, skillId);
}
```

Delete the `SharesMinted` case entirely.

- [ ] **Step 4: Update settlement projection**

In `PeriodSettled`, replace `snapshot_total_shares` projections with:

```ts
const authorOwnershipBps = Number(ev.data.authorOwnershipBps);
const contributorPoolBps = Number(ev.data.contributorPoolBps);
db.prepare(`INSERT INTO revenue_history
  (skill_id, period_start, period_end, period_revenue, snapshot_author_ownership_bps, snapshot_contributor_pool_bps)
  VALUES (?,?,?,?,?,?)`)
  .run(skillId, periodStart, t, periodRevenue, authorOwnershipBps, contributorPoolBps);
db.prepare(`UPDATE revenue_pools
  SET current_period_revenue = 0,
      total_lifetime_revenue = total_lifetime_revenue + ?,
      current_period_start = ?,
      snapshot_author_ownership_bps = ?,
      snapshot_contributor_pool_bps = ?,
      last_settlement_time = ?
  WHERE skill_id = ?`)
  .run(periodRevenue, t, authorOwnershipBps, contributorPoolBps, t, skillId);
```

- [ ] **Step 5: Update indexer tests**

In `tests/indexer/projection.test.ts`, replace fixtures that insert `total_shares`, `author_shares`, and `shares` with the new columns.

Replace the old `SharesMinted updates total_shares + adds contributor` test with:

```ts
it("ExperienceEvaluated updates ownership ledger and contributor weight", async () => {
  db.prepare(`INSERT INTO share_ledgers
    (skill_id, author_ownership_bps, contributor_pool_bps, min_author_ratio_bps, total_contributor_weight, contributor_count, points_per_100bps, max_pool_increase_per_evaluation_bps, last_snapshot_time)
    VALUES (?,10000,0,4000,0,0,250,500,100)`).run(SKILL.toBase58());
  db.prepare(`INSERT INTO share_accounts (holder, skill_id, contribution_weight, lock_until) VALUES (?,?,0,0)`)
    .run(BOB.toBase58(), SKILL.toBase58());

  await applyEventForTest(db, {
    name: "ExperienceEvaluated",
    data: {
      skill: SKILL,
      experienceId: 0,
      contributor: BOB,
      score: 38,
      contributionWeightDelta: 95,
      ownershipDeltaBps: 0,
      authorOwnershipBps: 10000,
      contributorPoolBps: 0,
      approved: true,
    },
  } as any);

  const ledger = db.prepare(`SELECT total_contributor_weight, contributor_count FROM share_ledgers WHERE skill_id = ?`)
    .get(SKILL.toBase58()) as any;
  expect(ledger.total_contributor_weight).toBe(95);
  expect(ledger.contributor_count).toBe(1);

  const share = db.prepare(`SELECT contribution_weight FROM share_accounts WHERE holder = ? AND skill_id = ?`)
    .get(BOB.toBase58(), SKILL.toBase58()) as any;
  expect(share.contribution_weight).toBe(95);
});
```

- [ ] **Step 6: Run indexer and migration tests**

Run:

```bash
pnpm vitest run tests/chain/db-migrations.test.ts tests/indexer/projection.test.ts tests/indexer/tick.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add lib/db.ts lib/indexer.ts tests/chain/db-migrations.test.ts tests/indexer/projection.test.ts tests/indexer/tick.test.ts
git commit -m "Project ownership weights in the indexer"
```

---

### Task 7: API Response Shape

**Files:**
- Modify: `app/api/skills/[id]/route.ts`
- Modify: `app/api/skills/[id]/experiences/route.ts`
- Modify: `app/api/skills/route.ts`
- Modify: `app/api/shares/[skillId]/route.ts`
- Modify: `app/api/shares/route.ts`
- Modify: `app/api/me/route.ts`
- Modify: `app/api/experiences/[id]/route.ts`
- Modify: `app/api/revenue/[skillId]/route.ts`
- Modify: `app/api/indexer/status/route.ts`
- Add or modify API tests if existing coverage touches these routes.

- [ ] **Step 1: Add shared ownership mapping helper**

If no API helper file already fits, add this function to `lib/api-helpers.ts`:

```ts
export function ownershipPct(ownershipBps: number): number {
  return ownershipBps / 100;
}

export function contributorOwnershipBps({
  contributorPoolBps,
  contributionWeight,
  totalContributorWeight,
}: {
  contributorPoolBps: number;
  contributionWeight: number;
  totalContributorWeight: number;
}): number {
  if (totalContributorWeight <= 0 || contributionWeight <= 0) return 0;
  return Math.floor((contributorPoolBps * contributionWeight) / totalContributorWeight);
}
```

- [ ] **Step 2: Update skill detail API**

In `app/api/skills/[id]/route.ts`, change holder query to:

```sql
SELECT holder, contribution_weight, lock_until, first_contribution_at, last_contribution_at
FROM share_accounts
WHERE skill_id = ?
ORDER BY contribution_weight DESC
```

Return ledger as:

```ts
ledger: {
  authorOwnershipBps: ledger.author_ownership_bps,
  contributorPoolBps: ledger.contributor_pool_bps,
  minAuthorRatioBps: ledger.min_author_ratio_bps,
  totalContributorWeight: ledger.total_contributor_weight,
  contributorCount: ledger.contributor_count,
}
```

Return cap table rows:

```ts
holders: holders.map((h) => {
  const isAuthor = h.holder === skill.author;
  const ownershipBps = isAuthor
    ? ledger.author_ownership_bps
    : contributorOwnershipBps({
        contributorPoolBps: ledger.contributor_pool_bps,
        contributionWeight: h.contribution_weight,
        totalContributorWeight: ledger.total_contributor_weight,
      });
  return {
    holder: h.holder,
    role: isAuthor ? "author" : "contributor",
    ownershipBps,
    ownershipPct: ownershipPct(ownershipBps),
    lockUntil: h.lock_until,
    firstContributionAt: h.first_contribution_at,
    lastContributionAt: h.last_contribution_at,
  };
})
```

Return experiences with:

```ts
contributionWeightDelta: e.contribution_weight_delta,
ownershipDeltaBps: e.ownership_delta_bps,
ownershipDeltaPct: e.ownership_delta_bps == null ? null : ownershipPct(e.ownership_delta_bps),
```

Do not return `sharesMinted`.

- [ ] **Step 3: Update list and personal APIs**

In `app/api/skills/route.ts`, replace `totalShares` and `authorShares` with:

```ts
authorOwnershipBps: r.author_ownership_bps,
authorOwnershipPct: ownershipPct(r.author_ownership_bps),
contributorPoolBps: r.contributor_pool_bps,
contributorPoolPct: ownershipPct(r.contributor_pool_bps),
```

In `app/api/me/route.ts`, update holdings query to use `contribution_weight > 0` and return `ownershipBps`/`ownershipPct` instead of `shares`/`totalShares`.

In `app/api/shares/route.ts` and `app/api/shares/[skillId]/route.ts`, return cap table ownership rows using the helper. Keep route paths unchanged to avoid a wider navigation refactor.

In `app/api/experiences/[id]/route.ts` and `app/api/skills/[id]/experiences/route.ts`, replace `sharesMinted` with `ownershipDeltaBps` and `ownershipDeltaPct`.

In `app/api/revenue/[skillId]/route.ts`, replace `snapshotTotalShares` with:

```ts
snapshotAuthorOwnershipBps: h.snapshot_author_ownership_bps,
snapshotContributorPoolBps: h.snapshot_contributor_pool_bps,
```

In `app/api/indexer/status/route.ts`, compare `author_ownership_bps`, `contributor_pool_bps`, and `total_contributor_weight` against chain account fields instead of `total_shares`.

- [ ] **Step 4: Run typecheck and API-adjacent tests**

Run:

```bash
pnpm typecheck
pnpm vitest run tests/seed/demo.test.ts tests/demo/console-bundle.test.ts
```

Expected: typecheck may expose UI references still using old API fields. Fix API compile errors in this task; UI display fixes are Task 8.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/api-helpers.ts app/api tests/seed/demo.test.ts tests/demo/console-bundle.test.ts
git commit -m "Expose derived ownership percentages from APIs"
```

---

### Task 8: Seed Data and Demo Copy

**Files:**
- Modify: `lib/seed/demo.ts`
- Modify: `lib/demo/console-bundle.ts` only if copy includes raw shares.
- Modify: `app/console/page.tsx`
- Modify: `app/page.tsx`
- Modify: `app/deck/page.tsx`
- Modify: `README.md`

- [ ] **Step 1: Update seed data inserts**

In `lib/seed/demo.ts`, replace `share_ledgers` insert columns with:

```sql
skill_id,
author_ownership_bps,
contributor_pool_bps,
min_author_ratio_bps,
total_contributor_weight,
contributor_count,
points_per_100bps,
max_pool_increase_per_evaluation_bps,
last_snapshot_time
```

Use initial values:

```ts
author_ownership_bps = 10000
contributor_pool_bps = 0
total_contributor_weight = 0
contributor_count = 0
points_per_100bps = 250
max_pool_increase_per_evaluation_bps = 500
```

Replace `share_accounts.shares` with `share_accounts.contribution_weight`.

- [ ] **Step 2: Update console flow copy**

In `app/console/page.tsx`, replace:

```ts
"Contract mints 380 shares for Bob. Alice 72.5% / Bob 27.5%."
```

with:

```ts
"Contract updates ownership from the judge score. Bob gains a small early-stage ownership slice; Alice remains far above her floor."
```

Replace UI labels that say `shares` with `ownership` or `ownership %`.

- [ ] **Step 3: Update marketing/deck copy**

In `app/page.tsx`, replace claims like:

```txt
Score 38/50 -> 380 shares minted to Bob
```

with:

```txt
Score 38/50 -> Bob's ownership percentage updates, dampened for early-stage fairness
```

In `app/deck/page.tsx`, replace `shares minted` and `380 shares` snippets with `ownership updated` and `ownership %`.

In `README.md`, replace "shares minted" explanations with "ownership percentages are derived from judged contributions; early contributions are dampened and later contributors can still earn ownership after the author reaches the floor."

- [ ] **Step 4: Run seed/demo tests**

Run:

```bash
pnpm vitest run tests/seed/demo.test.ts tests/demo/console-bundle.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/seed/demo.ts lib/demo/console-bundle.ts app/console/page.tsx app/page.tsx app/deck/page.tsx README.md tests/seed/demo.test.ts tests/demo/console-bundle.test.ts
git commit -m "Refresh demo copy for ownership percentages"
```

---

### Task 9: UI Ownership Display

**Files:**
- Modify: `app/skill/[id]/page.tsx`
- Modify: `app/me/page.tsx`
- Modify: `components/charts/StackedShareBar.tsx`
- Modify: related layout tests if any snapshot/DOM assertions reference old labels.

- [ ] **Step 1: Update skill page cap table**

In `app/skill/[id]/page.tsx`, replace raw share display:

```tsx
{exp.sharesMinted ? <span className="font-mono text-[11px] text-accent">+{exp.sharesMinted} shares</span> : null}
```

with:

```tsx
{exp.ownershipDeltaPct ? (
  <span className="font-mono text-[11px] text-accent">+{exp.ownershipDeltaPct.toFixed(2)}% ownership</span>
) : null}
```

For cap table rows, render:

```tsx
<span className="font-mono">{holder.ownershipPct.toFixed(2)}%</span>
```

Do not show `contributionWeight`.

- [ ] **Step 2: Update me page holdings**

In `app/me/page.tsx`, replace holdings columns:

```ts
{ k: "shares", label: "shares" }
{ k: "totalShares", label: "total" }
{ k: "pct", label: "%" }
```

with:

```ts
{ k: "ownershipPct", label: "ownership", render: (r: any) => `${r.ownershipPct.toFixed(2)}%` }
```

Replace contribution row minted display:

```ts
{ k: "sharesMinted", label: "minted", render: (r: any) => r.sharesMinted ? `+${r.sharesMinted}` : "—" }
```

with:

```ts
{ k: "ownershipDeltaPct", label: "ownership", render: (r: any) => r.ownershipDeltaPct ? `+${r.ownershipDeltaPct.toFixed(2)}%` : "—" }
```

- [ ] **Step 3: Update stacked chart component contract**

If `components/charts/StackedShareBar.tsx` accepts `shares`, rename props to ownership:

```ts
interface Segment {
  holder: string;
  ownershipPct: number;
}
```

Render segment widths from `ownershipPct`, not `shares / totalShares`.

- [ ] **Step 4: Run frontend checks**

Run:

```bash
pnpm typecheck
pnpm vitest run tests/layout/site-frame-navigation.test.ts tests/layout/fonts.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/skill/[id]/page.tsx app/me/page.tsx components/charts/StackedShareBar.tsx tests/layout
git commit -m "Show ownership percentages in the UI"
```

---

### Task 10: Full Verification and Cleanup

**Files:**
- Modify any missed references found by search.
- Update tests found by search.

- [ ] **Step 1: Search for stale share-minting terminology**

Run:

```bash
rg -n "sharesMinted|shares_minted|SharesMinted|shares minted|380 shares|total_shares|author_shares|snapshot_total_shares|shares / total|minted" .
```

Expected: only acceptable references are in historical design docs or explanatory comments that explicitly describe the old model. No app, program, API, DB, or active test code should depend on stale names.

- [ ] **Step 2: Fix active stale references**

For each active stale reference, replace it with one of:

```ts
ownershipDeltaBps
ownershipDeltaPct
contributionWeightDelta
authorOwnershipBps
contributorPoolBps
totalContributorWeight
```

Use user-facing copy:

```txt
ownership
ownership %
股份比例
```

Do not use user-facing copy:

```txt
points
weight
pool
minted shares
```

- [ ] **Step 3: Run full TypeScript verification**

Run:

```bash
pnpm typecheck
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Run Anchor verification**

Run:

```bash
cd programs && anchor test --skip-local-validator --skip-deploy
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Final commit**

Run:

```bash
git status --short
git add .
git commit -m "Complete contributor-weighted ownership migration"
```

Only create this final commit if Step 1 or verification fixes produced changes after the earlier task commits.

---

## Self-Review

Spec coverage:

- Early user dampening is covered by Tasks 1, 3, and 4.
- Later contributors at author floor are covered by Tasks 1, 2, 3, 4, and 6.
- Author floor preservation is covered by Tasks 1, 3, and 4.
- UI avoids internal concepts through Tasks 7, 8, and 9.
- Settlement matches displayed percentages through Tasks 2 and 4.
- No legacy compatibility is required; Task 6 intentionally replaces schema semantics directly.

Completion marker scan:

- The plan contains no unresolved fill-in sections.
- Steps include concrete file paths, commands, and expected outputs.

Type consistency:

- External/API names use camelCase: `ownershipBps`, `ownershipPct`, `ownershipDeltaBps`, `contributionWeightDelta`.
- SQLite/Rust/account names use snake_case: `ownership_delta_bps`, `contribution_weight_delta`, `total_contributor_weight`.
- User-facing copy uses ownership percentages and avoids exposing internal weight terminology.
