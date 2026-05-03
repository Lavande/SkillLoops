# Contributor-Weighted Ownership Model Design

## Context

The current share minting model grants `score * k` new shares until the author floor is reached. This creates two protocol problems:

- An early high-scoring contributor can quickly dilute the author to the floor.
- Once the author is at the floor, later contributors cannot receive meaningful ownership because any normal share issuance would dilute the author below the floor.

The product language should remain simple. Users should not see new protocol terms such as points, weight, pools, or internal accounting. The UI should continue to communicate ownership as percentages.

This project is not live yet, so this change does not need a legacy migration path. Chain state, indexer projections, tests, and UI copy can be changed directly.

## Goals

- Slow early author dilution so one or two early contributors cannot take the skill to the author floor.
- Keep later contributions meaningful after the author reaches the floor.
- Preserve the rule that the author is never diluted below their configured floor.
- Keep the user-facing model as direct ownership percentages.
- Make settlement match the displayed ownership percentages.
- Keep the chain implementation deterministic and testable with integer arithmetic.

## Non-Goals

- Preserve compatibility with the current `total_shares / author_shares` semantics.
- Expose internal contribution weights to users.
- Add governance, trading, secondary transfers, or share sales.
- Optimize for arbitrary numbers of settlement accounts beyond the current explicit-holder settlement pattern.

## Recommended Model

Replace raw share minting with internal contributor weights and derived ownership percentages.

The ledger stores:

- `author_ownership_bps`: the author's current ownership in basis points.
- `min_author_ratio_bps`: the author's floor, also in basis points.
- `contributor_pool_bps`: `10000 - author_ownership_bps`.
- `total_contributor_weight`: total internal weight across contributors.
- `points_per_100bps`: how much contributor weight unlocks each 1% of the contributor ownership pool.
- `max_pool_increase_per_evaluation_bps`: maximum contributor pool growth from a single approved evaluation.

Each contributor account stores:

- `contribution_weight`: internal weight earned from approved experience bundles.
- contribution timestamps and lock metadata as needed by the existing UX.

The API and UI derive and expose:

- `ownershipBps`
- `ownershipPct`
- `role`

The UI should not expose `contribution_weight` unless a future debugging/admin surface needs it.

## Evaluation Algorithm

When a pending experience is evaluated:

1. Reject if `score < MIN_APPROVE_SCORE`.
2. Compute raw contribution weight:

   ```text
   raw_weight = score * k
   ```

3. Apply an early-contributor multiplier:

   ```text
   effective_weight = floor(raw_weight * early_multiplier_bps / 10000)
   ```

4. Add the weight to the contributor account and ledger total:

   ```text
   contributor.contribution_weight += effective_weight
   ledger.total_contributor_weight += effective_weight
   ```

5. Compute the target contributor pool:

   ```text
   max_pool_bps = 10000 - min_author_ratio_bps

   target_pool_bps = min(
     max_pool_bps,
     floor(total_contributor_weight / points_per_100bps) * 100
   )
   ```

6. Limit single-evaluation pool expansion:

   ```text
   new_pool_bps = min(
     target_pool_bps,
     old_contributor_pool_bps + max_pool_increase_per_evaluation_bps
   )
   ```

7. Derive author ownership:

   ```text
   author_ownership_bps = 10000 - new_pool_bps
   contributor_pool_bps = new_pool_bps
   ```

This means an approved contributor can always gain internal weight. If the author is already at the floor, `contributor_pool_bps` stays fixed and the new contributor dilutes only existing contributors inside the contributor pool.

## Initial Parameters

Recommended defaults:

```text
points_per_100bps = 250
max_pool_increase_per_evaluation_bps = 500
```

Recommended early-contributor multipliers:

```text
first nonzero contributor:       2500 bps  // 25%
second and third contributors:   4000 bps  // 40%
fourth through ninth:            6500 bps  // 65%
tenth and later:                10000 bps  // 100%
```

Contributor count should mean accounts that move from zero weight to nonzero weight. A returning contributor should use the tier implied by the current nonzero contributor count, not receive the first-contributor discount again.

The multiplier is a dampener, not a quality judgment. The judge score still determines raw weight.

## Ownership Derivation

The author owns:

```text
author_ownership_bps
```

A contributor owns:

```text
contributor_ownership_bps =
  floor(contributor_pool_bps * contributor_weight / total_contributor_weight)
```

Integer remainders should be handled consistently with the existing revenue-claim approach:

- For display, percentages can show rounded decimal values from exact basis-point values.
- For settlement, allocate the lamport remainder to the largest effective ownership holder, with deterministic tie-breaking by holder order.

If `total_contributor_weight == 0`, the author owns 100% and the contributor pool is treated as 0 even if stored state is inconsistent.

## Settlement Algorithm

Settlement must distribute revenue according to derived ownership, not raw internal weights alone.

For each period:

1. Calculate the author claim:

   ```text
   author_claim = floor(period_revenue * author_ownership_bps / 10000)
   ```

2. Calculate contributor revenue:

   ```text
   contributor_revenue = period_revenue - author_claim
   ```

3. Distribute contributor revenue among contributors:

   ```text
   contributor_claim_i =
     floor(contributor_revenue * contributor_weight_i / total_contributor_weight)
   ```

4. Assign any remaining lamports to the holder with the largest effective ownership, with deterministic tie-breaking.

The settlement instruction should require the author share account plus all nonzero contributor share accounts. It should verify that the provided contributor weights sum to `ledger.total_contributor_weight`.

## User-Facing Product Behavior

All user-facing surfaces should continue to speak in ownership percentages.

Cap table rows:

```text
Alice     Author       95.00%
Bob       Contributor   5.00%
Charlie   Contributor   0.00%
```

Evaluation result copy:

```text
Bob gained +5.00% ownership.
Alice changed 100.00% -> 95.00%.
```

When the author is at the floor:

```text
Charlie gained +15.00% ownership.
Alice stayed at 40.00%.
Bob changed 60.00% -> 45.00%.
```

The UI should avoid showing "points earned", "weight", or "contributor pool" in normal user flows. It may show judge score and ownership percentage change.

## Worked Examples

### First Strong Contributor

Inputs:

```text
floor = 40%
k = 100
score = 50
points_per_100bps = 250
max_pool_increase_per_evaluation_bps = 500
first contributor multiplier = 25%
```

Calculation:

```text
raw_weight = 50 * 100 = 5000
effective_weight = 5000 * 25% = 1250
target_pool_bps = floor(1250 / 250) * 100 = 500
new_pool_bps = min(500, 0 + 500) = 500
```

Displayed result:

```text
Author = 95%
Bob = 5%
```

The contributor received meaningful ownership but did not push the author near the floor.

### Author Already At Floor

Inputs:

```text
author = 40%
contributor_pool = 60%
Bob weight = 1500
Charlie new weight = 500
total contributor weight = 2000
```

Displayed result:

```text
Alice = 40%
Bob = 1500 / 2000 * 60% = 45%
Charlie = 500 / 2000 * 60% = 15%
```

Charlie receives meaningful ownership. Bob is diluted inside the contributor pool. Alice is not diluted below the floor.

## Chain State Changes

Replace or repurpose current share ledger fields around raw total shares:

```rust
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
```

Replace or repurpose contributor share account fields:

```rust
pub struct ShareAccount {
    pub holder: Pubkey,
    pub skill: Pubkey,
    pub contribution_weight: u64,
    pub lock_until: i64,
    pub first_contribution_at: i64,
    pub last_contribution_at: i64,
    pub bump: u8,
}
```

The author should still have a share account for settlement and cap table consistency, but their ownership is derived from the ledger's `author_ownership_bps`, not contribution weight.

## API Changes

Skill detail and share APIs should return derived percentages:

```ts
interface CapTableRow {
  holder: string;
  role: "author" | "contributor";
  ownershipBps: number;
  ownershipPct: number;
  lockUntil?: number;
  firstContributionAt?: number;
  lastContributionAt?: number;
}
```

Experience rows should return:

```ts
interface ExperienceRow {
  contributionScore: number | null;
  ownershipDeltaBps: number | null;
  evaluatedAt: number | null;
}
```

The API can keep internal debug fields out of the default response.

## Testing Requirements

Domain tests:

- Score below 20 rejects and changes no ownership.
- First max-score contributor gets 5% with the recommended defaults.
- Multiple early contributors move the author down gradually.
- Author never drops below floor.
- At floor, a new contributor dilutes existing contributors only.
- Returning contributors add weight without incrementing contributor count.
- Zero contributor weight gives the author 100%.
- Remainder distribution is deterministic.

Program tests:

- `evaluate_experience` updates contributor weight and derived ledger ownership.
- `evaluate_experience` emits events containing score and ownership delta, not misleading raw minted shares.
- Settlement requires complete holder accounts and verifies total contributor weight.
- Settlement pays the author floor exactly when the author is at floor.
- Settlement pays later contributors after the author reaches floor.

UI/API tests:

- Cap table displays percentages, not internal weights.
- Experience history displays score and ownership delta.
- The console demo no longer claims `38/50 -> 380 shares`; it should show a percentage change.

## Open Implementation Notes

- Event names and fields should be renamed away from `SharesMinted` if the event no longer represents raw share issuance.
- Copy should consistently use "ownership" or "股份比例" rather than "points" or "weight".
- Existing seed/demo data can be rewritten directly because the product is not live.
