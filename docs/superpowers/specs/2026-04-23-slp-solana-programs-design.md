# Skill Loops — Solana Programs (Slice 2) — Design

## Context

Slice 1 delivered a Next.js frontend shell backed by a persistent mock backend (SQLite + in-process adapters), with pure domain logic in `lib/domain/*` that encodes the PRD's share-minting and revenue-distribution formulas. Slice 1 is complete, tested (17 Vitest + 1 Playwright), and currently demoable end-to-end.

This slice ports the domain logic to Solana as an Anchor program, with LiteSVM-based integration tests proving the contract behaves identically to the TypeScript reference implementation. The frontend is **not** touched in this slice; the mock backend keeps working throughout. Deployment to devnet, TS client generation, and frontend rewiring are the job of Slice 3.

The goal is a correct contract layer we can trust before we wire anything real to it. Slice 2 is an infrastructure slice — it produces no visual change — but it is the slice where the protocol's economic rules become enforceable on-chain.

## Scope

**In scope**
- Single Anchor workspace under `programs/` at the repo root.
- One monolithic `slp` program containing all instructions and account types.
- Eight on-chain account types (`ProtocolConfig`, `Skill`, `SkillVersion`, `ShareLedger`, `ShareAccount`, `Subscription`, `ExperienceRecord`, `RevenuePool`, `ClaimableRevenue`) with PDA seeds.
- Eight instructions (`initialize_protocol`, `publish_skill`, `subscribe`, `submit_experience`, `evaluate_experience`, `settle_period`, `claim_revenue`, `publish_new_version`).
- Pure Rust math module (`math.rs`) mirroring `lib/domain/shares.ts` and `lib/domain/revenue.ts`, with inline unit tests.
- LiteSVM integration test suite: one happy-path test per PRD act plus ~20 adversarial / boundary tests.
- Judge authorization via keypair-signer check against `ProtocolConfig.judge`.
- Permissionless `settle_period` that takes holders as `remaining_accounts` and creates `ClaimableRevenue` PDAs in one transaction.
- Per-skill `RevenuePool` PDA that physically holds lamports.

**Out of scope (explicitly deferred)**
- No deployment to devnet, testnet, or mainnet.
- No Anchor IDL consumers — no TypeScript client generation (Codama), no frontend rewiring. The existing Next.js app and mock API routes are untouched.
- No AI Judge service (still deterministic mock in Slice 1).
- No real Lit Protocol, Irys, or Arweave integration.
- No compute-budget optimization or CU measurement.
- No program upgradability strategy.
- No ed25519 sysvar verification (single-Judge keypair-signer is sufficient for the MVP; multi-judge voting is a future slice).
- No property-based / fuzz testing (the TS domain suite already covers the math).

## Architecture

Single Cargo workspace under `programs/` at the repo root. Zero coupling to the Next.js app: the Rust tree is independent, builds with `cargo` / `anchor build`, and is ignored by the Next.js build.

### Workspace layout

```
SkillLoops/
├─ programs/
│  ├─ Cargo.toml                    workspace manifest
│  ├─ Anchor.toml                   program id, cluster=localnet
│  ├─ rust-toolchain.toml           pinned 1.79.0
│  ├─ slp/
│  │  ├─ Cargo.toml                 [lib] crate-type = ["cdylib","lib"]
│  │  ├─ Xargo.toml
│  │  └─ src/
│  │     ├─ lib.rs                  declare_id! + #[program] mod
│  │     ├─ constants.rs
│  │     ├─ error.rs                #[error_code] SlpError
│  │     ├─ events.rs
│  │     ├─ math.rs                 pure fns + inline #[test]s
│  │     ├─ state/
│  │     │  ├─ mod.rs
│  │     │  ├─ config.rs
│  │     │  ├─ skill.rs
│  │     │  ├─ subscription.rs
│  │     │  ├─ shares.rs
│  │     │  ├─ experience.rs
│  │     │  └─ revenue.rs
│  │     └─ instructions/
│  │        ├─ mod.rs
│  │        ├─ initialize_protocol.rs
│  │        ├─ publish_skill.rs
│  │        ├─ subscribe.rs
│  │        ├─ submit_experience.rs
│  │        ├─ evaluate_experience.rs
│  │        ├─ settle_period.rs
│  │        ├─ claim_revenue.rs
│  │        └─ publish_new_version.rs
│  └─ tests/
│     ├─ common/
│     │  ├─ mod.rs                  LiteSVM bootstrap, ix builders
│     │  └─ fixtures.rs             demo personas, skill template
│     ├─ golden_flow.rs
│     ├─ adversarial.rs
└─ (existing Next.js tree untouched)
```

### Toolchain

- Rust 1.85.0 (pinned via `rust-toolchain.toml`). Updated from the originally-specced 1.79 during Slice 2 execution (2026-04-24): the current crate graph pulls `hybrid-array 0.4.10` transitively via `blake3` → `digest 0.11`, which requires `edition2024` (stabilized in Rust 1.85).
- Anchor 0.30.1 (via `avm`).
- Agave 2.2.20 (Solana 2.x). Updated from the originally-specced Solana 1.18 because LiteSVM 0.5 requires `solana-* 2.x` and because 1.18's platform-tools bundles Rust 1.75, which cannot compile the `edition2024` transitives.
- `litesvm` 0.5.x for integration tests.

### Key principles

1. **Math is pure and portable.** `math.rs` is `no_std`-safe Rust mirroring the TS domain code. Tests for it are plain `#[test]` functions. This is the on-chain reference implementation of the PRD formulas.
2. **Anchor for account constraints.** `has_one`, `seeds`, `bump`, and discriminator checks eliminate the most common Solana bug class (wrong account substitution) at the macro level.
3. **Integration tests link against the built `.so`.** Fast (~10 ms/test), real program execution, no mocked accounts. No devnet round-trips.
4. **Uniform cap-table model.** The skill author gets a `ShareAccount` at `publish_skill` time, same as any other shareholder. No author/contributor branching in `settle_period`.
5. **`ledger.total_shares` is the invariant.** It equals the sum of all nonzero `ShareAccount.shares` for a skill. Settlement enforces this invariant by requiring the caller to pass every nonzero holder in `remaining_accounts`.

## Data model

### PDA seeds

```
config                 ["config"]
skill                  ["skill", author, name_hash_16]
version                ["version", skill, version_le]
ledger                 ["ledger", skill]
pool                   ["pool", skill]
share                  ["share", skill, holder]
subscription           ["sub", skill, subscriber]
experience             ["exp", skill, experience_id_le]
claim                  ["claim", skill, holder, snapshot_id_le]
```

`name_hash_16` is the first 16 bytes of `sha256(name.as_bytes())`, making skill PDAs deterministic from `(author, name)` while keeping the seed bounded.

### Accounts

All sizes include Anchor's 8-byte discriminator. `String` fields use `(4 + max_len)`.

**`ProtocolConfig`** — singleton, created once via `initialize_protocol`.
```rust
pub struct ProtocolConfig {
    pub admin: Pubkey,
    pub judge: Pubkey,
    pub bump: u8,
}
// Space: 8 + 32 + 32 + 1 = 73
```

**`Skill`** — per-skill metadata and counters.
```rust
pub struct Skill {
    pub author: Pubkey,
    pub name: String,              // max 64
    pub description: String,       // max 256
    pub category: String,          // max 32
    pub current_version: u32,
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,     // max 64
    pub subscription_price: u64,
    pub min_author_ratio_bps: u16,
    pub k: u16,
    pub created_at: i64,
    pub updated_at: i64,
    pub subscriber_count: u32,
    pub total_revenue: u64,
    pub next_experience_id: u64,
    pub bump: u8,
}
// Space: 8 + 32 + (4+64) + (4+256) + (4+32) + 4 + 32 + (4+64) + 8 + 2 + 2 + 8 + 8 + 4 + 8 + 8 + 1 = ~553
```

Two additions to the PRD: `k` (per-skill contribution coefficient, mentioned as configurable in §5.1 but never placed on an account) and `next_experience_id` (needed to derive `ExperienceRecord` PDAs deterministically).

**`SkillVersion`** — one per published version.
```rust
pub struct SkillVersion {
    pub skill: Pubkey,
    pub version: u32,
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,                 // max 64
    pub contributing_experience_ids: Vec<u64>, // max 16
    pub published_at: i64,
    pub bump: u8,
}
// Space: 8 + 32 + 4 + 32 + (4+64) + (4 + 16*8) + 8 + 1 ≈ 285
```

`MAX_CONTRIBUTORS_PER_VERSION = 16`. A version incorporating more than 16 contributions must be split into multiple version bumps — acceptable for hackathon scope.

**`ShareLedger`** — cap-table header.
```rust
pub struct ShareLedger {
    pub skill: Pubkey,
    pub total_shares: u64,
    pub author_shares: u64,
    pub min_author_ratio_bps: u16,
    pub contributor_count: u32,
    pub last_snapshot_time: i64,
    pub bump: u8,
}
// Space: 8 + 32 + 8 + 8 + 2 + 4 + 8 + 1 = 71
```

`author_shares` is preserved in the ledger for read-side convenience and as the input to `math::mint_contribution_shares`. It is never modified after `publish_skill`.

**`ShareAccount`** — one per `(holder, skill)`.
```rust
pub struct ShareAccount {
    pub holder: Pubkey,
    pub skill: Pubkey,
    pub shares: u64,
    pub lock_until: i64,
    pub first_contribution_at: i64,
    pub last_contribution_at: i64,
    pub bump: u8,
}
// Space: 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1 = 105
```

Created at `publish_skill` (for the author, shares=1000) and at `subscribe` (shares=0). Also created lazily at `submit_experience` if the contributor has no existing `ShareAccount` for this skill.

**`Subscription`** — one per `(subscriber, skill)`.
```rust
pub struct Subscription {
    pub subscriber: Pubkey,
    pub skill: Pubkey,
    pub start_time: i64,
    pub expiry_time: i64,
    pub total_calls: u64,
    pub is_active: bool,
    pub bump: u8,
}
// Space: 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1 = 98
```

Resubscribe while active extends `expiry_time` by `SUBSCRIPTION_PERIOD_SECONDS`. Resubscribe after expiry resets `start_time` and `expiry_time`.

**`ExperienceRecord`** — one per submitted bundle.
```rust
pub struct ExperienceRecord {
    pub experience_id: u64,
    pub skill: Pubkey,
    pub contributor: Pubkey,
    pub skill_version: u32,
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,         // max 64
    pub status: u8,                    // 0=Pending, 1=Evaluated, 2=Rejected
    pub contribution_score: u8,
    pub shares_minted: u64,
    pub submitted_at: i64,
    pub evaluated_at: i64,
    pub judge_report_tx_id: String,    // max 64
    pub bump: u8,
}
// Space: ~279
```

`status` is an Anchor-friendly `u8` rather than a bare Rust enum (simpler zero-copy semantics). Constants are `STATUS_PENDING = 0`, `STATUS_EVALUATED = 1`, `STATUS_REJECTED = 2`.

**`RevenuePool`** — per-skill lamport vault + bookkeeping.
```rust
pub struct RevenuePool {
    pub skill: Pubkey,
    pub current_period_revenue: u64,
    pub total_lifetime_revenue: u64,
    pub current_period_start: i64,
    pub period_length: i64,
    pub snapshot_total_shares: u64,
    pub snapshot_id: u64,
    pub last_settlement_time: i64,
    pub bump: u8,
}
// Space: 8 + 32 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 1 = 97
```

This account physically holds the pool's SOL. `subscribe` uses `system_program::transfer` CPI to deposit; `claim_revenue` decrements lamports via direct `try_borrow_mut_lamports`. The pool lamport balance must remain above rent-exempt minimum — `claim_revenue` checks this explicitly.

**`ClaimableRevenue`** — per-holder-per-period payout entry.
```rust
pub struct ClaimableRevenue {
    pub holder: Pubkey,
    pub skill: Pubkey,
    pub amount: u64,
    pub snapshot_id: u64,
    pub bump: u8,
}
// Space: 8 + 32 + 32 + 8 + 8 + 1 = 89
```

Created during `settle_period`. `claim_revenue` closes the account (`close = holder`), returning rent.

## Instructions

### 1. `initialize_protocol`

**Signer:** admin
**Creates:** `ProtocolConfig`
**Args:** `judge: Pubkey`
**Effect:** sets `{admin: signer, judge, bump}`. Idempotent is not required — Anchor's `init` will fail if already initialized.

### 2. `publish_skill`

**Signer:** author
**Creates:** `Skill`, `SkillVersion(v=1)`, `ShareLedger`, `RevenuePool`, `ShareAccount(author)`
**Args:** `name, description, category, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, k, period_length`
**Preconditions:**
- `subscription_price > 0` else `ZeroPrice`
- `min_author_ratio_bps >= MIN_AUTHOR_RATIO_BPS_FLOOR (3000)` else `FloorTooLow`
- `K_MIN <= k <= K_MAX` else `InvalidK`
- String lengths within bounds else `StringTooLong`
**Effect:**
- `Skill` populated, `current_version = 1`, `next_experience_id = 0`, counters zeroed.
- `SkillVersion(1)` created with `contributing_experience_ids = []`.
- `ShareLedger { total_shares: 1000, author_shares: 1000, min_author_ratio_bps, contributor_count: 0, last_snapshot_time: now }`.
- `RevenuePool { period_length, current_period_start: now, snapshot_id: 0, everything else zero }`.
- `ShareAccount(author) { shares: 1000, lock_until: 0, first_contribution_at: 0, last_contribution_at: 0 }`.
**Event:** `SkillPublished`.

### 3. `subscribe`

**Signer:** subscriber
**Creates:** `Subscription` (if absent), `ShareAccount(subscriber)` (if absent)
**Mutates:** `Skill.subscriber_count`, `Skill.total_revenue`, `RevenuePool.current_period_revenue`, pool lamports
**Effect:**
- CPI `system_program::transfer(subscription_price)` from subscriber to pool.
- If `Subscription` is new or expired: `start_time = now`, `expiry_time = now + SUBSCRIPTION_PERIOD_SECONDS`, `is_active = true`, `Skill.subscriber_count += 1`.
- If active: `expiry_time += SUBSCRIPTION_PERIOD_SECONDS`. `subscriber_count` unchanged.
- `Skill.total_revenue += subscription_price`.
- `RevenuePool.current_period_revenue += subscription_price`.
- `ShareAccount` created at `shares = 0` if absent; untouched if it already exists (author, or previous subscriber).
**Event:** `Subscribed`.

### 4. `submit_experience`

**Signer:** contributor
**Creates:** `ExperienceRecord(status=Pending)`, `ShareAccount(contributor)` if absent
**Mutates:** `Skill.next_experience_id`
**Args:** `content_hash, arweave_tx_id, skill_version`
**Preconditions:** `arweave_tx_id` length within bounds.
**Effect:**
- `experience_id = Skill.next_experience_id` (PDA seed uses this value).
- `ExperienceRecord` populated: `status = Pending`, `submitted_at = now`, score / shares_minted / evaluated_at / judge_report_tx_id zeroed.
- `Skill.next_experience_id += 1`.
- `ShareAccount(contributor)` created at `shares = 0` if absent.

No subscription check — anyone can submit an experience; scoring below threshold handles junk.
**Event:** `ExperienceSubmitted`.

### 5. `evaluate_experience`

**Signer:** judge (must match `ProtocolConfig.judge`)
**Mutates:** `ExperienceRecord`, `ShareLedger`, `ShareAccount(contributor)`
**Args:** `score: u8`, `judge_report_tx_id: String`
**Preconditions:**
- `signer.key() == config.judge` else `NotJudge` (enforced via Anchor `has_one = judge`).
- `experience.status == Pending` else `AlreadyEvaluated`.
- `score <= 50` else `ScoreOutOfRange`.
- `experience.skill == skill.key()` (enforced via Anchor `has_one = skill`).
- `ledger.skill == skill.key()` (same).
- `contributor_share.holder == experience.contributor` and `contributor_share.skill == skill.key()`.

**Effect:**
- If `score < MIN_APPROVE_SCORE (20)`:
  - `experience.status = Rejected`
  - `experience.contribution_score = score`
  - `experience.evaluated_at = now`
  - `experience.judge_report_tx_id = judge_report_tx_id`
  - No mint.
  - Emit `ExperienceEvaluated { approved: false, shares_minted: 0 }`.
- Else:
  - Call `math::mint_contribution_shares({score, k: skill.k, author_shares: ledger.author_shares, total_shares: ledger.total_shares, min_author_ratio_bps: ledger.min_author_ratio_bps})` → `(shares_to_mint, floor_hit)`.
  - `ledger.total_shares += shares_to_mint` (author_shares unchanged).
  - `contributor_share.shares += shares_to_mint`.
  - If `contributor_share.first_contribution_at == 0`: set it to `now` and `ledger.contributor_count += 1`.
  - `contributor_share.last_contribution_at = now`.
  - `contributor_share.lock_until = now + LOCK_PERIOD_SECONDS`.
  - `ledger.last_snapshot_time = now`.
  - `experience.status = Evaluated`, populate fields.
  - Emit `ExperienceEvaluated { approved: true, shares_minted, floor_hit }` and (if shares > 0) `SharesMinted`.

### 6. `settle_period`

**Signer:** payer (permissionless)
**Mutates:** `RevenuePool`
**Creates:** `ClaimableRevenue × N` via `remaining_accounts`
**remaining_accounts:** pairs of `(ShareAccount(holder), ClaimableRevenue_PDA(holder, new_snapshot_id))` for every nonzero holder.
**Preconditions:**
- `now >= pool.current_period_start + pool.period_length` else `PeriodNotElapsed`.
- Each `ShareAccount` has `skill == this.skill` and `shares > 0` else `ShareAccountMismatch` / `SharesMustBeNonzero`.
- Each `ClaimableRevenue` PDA address matches `["claim", skill, holder, snapshot_id_le]` else `WrongClaimPda`.
- `Σ share_account.shares == ledger.total_shares` else `HoldersIncomplete`.

**Effect:**
- `snapshot_id = pool.snapshot_id + 1`.
- `period_revenue = pool.current_period_revenue`.
- Call `math::compute_claims` with the holder list (preserving remaining-accounts order) and `period_revenue, total_shares`.
- For each result, initialize the paired `ClaimableRevenue` PDA via `system_program::create_account` CPI, writing `{holder, skill, amount, snapshot_id, bump}`.
- `pool.total_lifetime_revenue += period_revenue`.
- `pool.current_period_revenue = 0`.
- `pool.current_period_start = now`.
- `pool.last_settlement_time = now`.
- `pool.snapshot_total_shares = ledger.total_shares`.
- `pool.snapshot_id = snapshot_id`.
- Emit `PeriodSettled`.

Special case: `period_revenue == 0`. We still advance `current_period_start` and `snapshot_id`, emit `PeriodSettled { period_revenue: 0 }`, and do not create any `ClaimableRevenue` PDAs. This is the "no subscriptions this period" path and is intentionally cheap.

### 7. `claim_revenue`

**Signer:** holder
**Mutates:** pool lamports, holder lamports
**Closes:** `ClaimableRevenue` (rent refunded to holder)
**Preconditions:**
- `claimable.holder == signer` (via Anchor `has_one = holder`).
- `claimable.amount > 0` else `NothingToClaim`.
- `pool.to_account_info().lamports() - amount >= rent_exempt_min(pool)` else `PoolBelowRentExempt` (hard reject, no clamping).

**Effect:**
- `**pool.try_borrow_mut_lamports()? -= amount`.
- `**holder.try_borrow_mut_lamports()? += amount`.
- Close `ClaimableRevenue` account (Anchor `close = holder`).
- Emit `RevenueClaimed`.

### 8. `publish_new_version`

**Signer:** author
**Creates:** `SkillVersion(v=current+1)`
**Mutates:** `Skill.current_version, content_hash, arweave_tx_id, updated_at`
**Args:** `content_hash, arweave_tx_id, contributing_experience_ids: Vec<u64>`
**Preconditions:**
- `skill.author == signer` (via Anchor `has_one = author`).
- `contributing_experience_ids.len() <= MAX_CONTRIBUTORS_PER_VERSION`.
- String lengths within bounds.

**Effect:**
- `new_version = skill.current_version + 1`.
- `SkillVersion(new_version)` created with the passed data and `published_at = now`.
- `Skill.current_version = new_version`.
- `Skill.content_hash = content_hash`.
- `Skill.arweave_tx_id = arweave_tx_id`.
- `Skill.updated_at = now`.
- Emit `VersionPublished`.

The spec does **not** validate that each `contributing_experience_id` refers to an `ExperienceRecord` in `Evaluated` status. The author is trusted to pick real contributors; misrepresentation is visible on-chain and socially punishable. Enforcing the check would require passing every ExperienceRecord as an account, which is cumbersome and does not match a common attack.

### Errors

```rust
#[error_code]
pub enum SlpError {
    #[msg("Caller is not the protocol Judge")]         NotJudge,
    #[msg("Experience already evaluated")]              AlreadyEvaluated,
    #[msg("Score must be 0..=50")]                       ScoreOutOfRange,
    #[msg("Experience does not belong to this skill")]   WrongSkill,
    #[msg("Settlement period has not elapsed")]          PeriodNotElapsed,
    #[msg("Settlement is missing holders")]              HoldersIncomplete,
    #[msg("ShareAccount belongs to wrong skill")]        ShareAccountMismatch,
    #[msg("Zero-share holders may not be settled")]      SharesMustBeNonzero,
    #[msg("ClaimableRevenue PDA is incorrect")]          WrongClaimPda,
    #[msg("Nothing to claim")]                           NothingToClaim,
    #[msg("Subscription price cannot be zero")]          ZeroPrice,
    #[msg("Author ratio floor below protocol minimum")]  FloorTooLow,
    #[msg("Contribution coefficient out of range")]      InvalidK,
    #[msg("String field exceeds maximum length")]        StringTooLong,
    #[msg("Only the skill author can publish new versions")] NotAuthor,
    #[msg("Too many contributing experiences for one version")] TooManyContributors,
    #[msg("Claim would leave pool below rent-exempt")]   PoolBelowRentExempt,
}
```

### Events

Emitted via `#[event]`:

- `SkillPublished { skill, author, name, created_at }`
- `Subscribed { skill, subscriber, expiry_time }`
- `ExperienceSubmitted { skill, experience_id, contributor }`
- `ExperienceEvaluated { skill, experience_id, score, shares_minted, approved, floor_hit }`
- `SharesMinted { skill, holder, amount, total_shares_after }`
- `PeriodSettled { skill, snapshot_id, period_revenue, total_shares }`
- `RevenueClaimed { skill, holder, amount, snapshot_id }`
- `VersionPublished { skill, version, contributing_count }`

These are consumed by Slice 3's indexer (or slice 4's real AI Judge event subscription).

## Math module

`programs/slp/src/math.rs`, pure Rust, `no_std`-safe, unit-tested inline.

### `mint_contribution_shares`

```rust
pub struct MintInput {
    pub score: u8,
    pub k: u16,
    pub author_shares: u64,
    pub total_shares: u64,
    pub min_author_ratio_bps: u16,
}

pub struct MintOutput {
    pub shares_to_mint: u64,
    pub floor_hit: bool,
}

pub fn mint_contribution_shares(i: MintInput) -> MintOutput {
    let base_shares = (i.score as u64).saturating_mul(i.k as u64);

    let max_total = (i.author_shares as u128)
        .saturating_mul(10_000u128)
        .checked_div(i.min_author_ratio_bps as u128)
        .unwrap_or(u128::MAX);
    let max_total_u64 = max_total.min(u64::MAX as u128) as u64;

    let headroom = max_total_u64.saturating_sub(i.total_shares);
    let shares_to_mint = base_shares.min(headroom);

    MintOutput {
        shares_to_mint,
        floor_hit: shares_to_mint < base_shares,
    }
}
```

**Verification against PRD demo**: `(score=38, k=10, author=1000, total=1000, bps=4000)` → `max_total=2500`, `headroom=1500`, `base=380`, `shares=380`, `floor_hit=false`. Post-mint ratio 1000/1380 = 72.46% ≥ 40%. ✓

### `compute_claims`

```rust
pub struct Holder {
    pub shares: u64,
    pub index: usize,
}

pub struct Claim {
    pub index: usize,
    pub amount: u64,
}

pub fn compute_claims(
    holders: &[Holder],
    period_revenue: u64,
    total_shares: u64,
) -> Vec<Claim> {
    if holders.is_empty() || total_shares == 0 || period_revenue == 0 {
        return holders.iter().map(|h| Claim { index: h.index, amount: 0 }).collect();
    }

    let mut claims: Vec<Claim> = holders.iter().map(|h| {
        let amount = ((period_revenue as u128) * (h.shares as u128)
                      / (total_shares as u128)) as u64;
        Claim { index: h.index, amount }
    }).collect();

    let distributed: u64 = claims.iter().map(|c| c.amount).sum();
    let remainder = period_revenue.saturating_sub(distributed);

    if remainder > 0 {
        // Largest-shares-wins; ties broken by smallest index for determinism.
        let (largest_pos, _) = holders.iter().enumerate()
            .max_by(|(ai, a), (bi, b)| {
                a.shares.cmp(&b.shares).then(bi.cmp(ai))
            }).unwrap();
        claims[largest_pos].amount += remainder;
    }

    claims
}
```

**Verification against PRD demo** (`Alice: 1000, Bob: 380; revenue=100M`):
- Alice: `100M * 1000 / 1380 = 72_463_768`
- Bob: `100M * 380 / 1380 = 27_536_231`
- Remainder 1 → Alice.
- Final: 72_463_769 + 27_536_231 = 100_000_000. ✓

Full-demo revenue 200M (Alice's subscribe + Carol's subscribe):
- Alice: 144_927_536 + 1 = 144_927_537.
- Bob: 55_072_463.
- Sum: 200_000_000. ✓ (Matches Slice 1's Vitest output exactly.)

### Constants

```rust
pub const MIN_APPROVE_SCORE: u8 = 20;
pub const K_DEFAULT: u16 = 10;
pub const K_MIN: u16 = 1;
pub const K_MAX: u16 = 100;
pub const INITIAL_TOTAL_SHARES: u64 = 1_000;
pub const MIN_AUTHOR_RATIO_BPS_FLOOR: u16 = 3_000;
pub const LOCK_PERIOD_SECONDS: i64 = 180 * 24 * 60 * 60;
pub const SUBSCRIPTION_PERIOD_SECONDS: i64 = 30 * 24 * 60 * 60;
pub const SETTLE_PERIOD_SECONDS_DEFAULT: i64 = 300;
pub const MAX_NAME_LEN: usize = 64;
pub const MAX_DESCRIPTION_LEN: usize = 256;
pub const MAX_CATEGORY_LEN: usize = 32;
pub const MAX_ARWEAVE_TX_ID_LEN: usize = 64;
pub const MAX_CONTRIBUTORS_PER_VERSION: usize = 16;
```

## Test plan

Three layers, ~40 tests total, runtime <5 seconds.

### Layer 1 — `programs/slp/src/math.rs` inline unit tests (~12 tests)

Pure Rust, no LiteSVM.

**`mint_contribution_shares`** (6):
1. PRD demo: `(38, 10, 1000, 1000, 4000)` → 380, no floor hit.
2. Floor boundary hit: `(50, 10, 1000, 2400, 4000)` → 100, floor_hit=true (headroom=100, base=500).
3. Threshold boundary: `(20, 10, 1000, 1000, 4000)` → 200.
4. Zero k: `(38, 0, 1000, 1000, 4000)` → 0.
5. Invariant post-mint: for any valid input, `(author * 10000) / (total + shares_to_mint) >= min_author_ratio_bps`.
6. Large-number overflow: `(50, 100, 1_000_000_000, 1_000_000_000, 3000)` → no panic, sensible result.

**`compute_claims`** (6):
1. PRD demo: `[1000, 380]`, 100M → `[72_463_769, 27_536_231]`, sum=100M.
2. Full-demo revenue: same holders, 200M → `[144_927_537, 55_072_463]`.
3. Zero-share middle holder: `[1000, 380, 0]`, 100M → `[72_463_769, 27_536_231, 0]`.
4. Single holder: `[1000]`, 100M → `[100_000_000]`.
5. Three-way tie: `[100, 100, 100]`, 100 → `[34, 33, 33]` (remainder=1 → index 0).
6. Empty / zero-revenue / zero-total-shares: return zero-amount claims without panicking.

### Layer 2 — `programs/tests/golden_flow.rs` (~6 tests)

LiteSVM, fresh bank per test. Shared `common::` helpers hide keypair/airdrop/ix-builder boilerplate.

1. **`publish_skill_initializes_cap_table`** — `Skill.current_version=1`, `ShareLedger.total_shares=1000`, author's `ShareAccount.shares=1000`, pool at rent-exempt min, `SkillVersion(1)` exists.
2. **`subscribe_creates_share_account_at_zero`** — `Subscription` created, `ShareAccount(Bob).shares=0`, pool lamports += 0.1 SOL, counters updated.
3. **`submit_and_evaluate_mints_shares`** — Bob submits, Judge evaluates at 38 → `status=Evaluated`, 380 minted, Bob's shares=380, `lock_until` set, `contributor_count=1`.
4. **`settle_distributes_proportionally`** — Carol subscribes, clock advances, `settle_period` called with Alice + Bob ShareAccounts (Carol skipped) → Alice claim=72_463_769, Bob claim=27_536_231, pool revenue zeroed, `snapshot_id=1`.
5. **`claim_transfers_lamports`** — both holders claim; lamports exact, claim PDAs closed, pool balance = rent-exempt min.
6. **`publish_new_version_records_contributor`** — Alice publishes v2 with `[bob_exp_id]` → `Skill.current_version=2`, `SkillVersion(2).contributing_experience_ids=[bob_exp_id]`.

### Layer 3 — `programs/tests/adversarial.rs` (~20 tests)

**`evaluate_experience`** (5):
- Non-Judge signer → `NotJudge`.
- Double-evaluate → `AlreadyEvaluated`.
- Score > 50 → `ScoreOutOfRange`.
- Score 19 → `Rejected`, 0 shares minted, ledger unchanged.
- Wrong ledger (different skill) → `has_one` constraint failure.

**`settle_period`** (5):
- Called before period elapsed → `PeriodNotElapsed`.
- Missing a holder in remaining_accounts → `HoldersIncomplete`.
- Zero-share holder in remaining_accounts → `SharesMustBeNonzero`.
- Double-settle same period → second call hits `PeriodNotElapsed` (period_start advanced).
- Post-floor-hit settle: sum-of-claims still equals revenue exactly.

**`claim_revenue`** (3):
- Holder B claims holder A's claimable → `has_one` constraint failure.
- Double-claim same PDA → `AccountNotInitialized` (already closed).
- Claim that would leave pool below rent-exempt minimum → `PoolBelowRentExempt` (hard reject; no clamping). Because settlement distributes lamports in exact proportion to shares and never touches the rent-exempt reserve, this error should never fire in normal operation; the test exists to pin the behavior against a buggy future change.

**`publish_skill` / `publish_new_version`** (4):
- Non-author calls new_version → `NotAuthor`.
- `min_author_ratio_bps = 2999` → `FloorTooLow`.
- `k = 0` → `InvalidK`.
- Name > 64 chars → `StringTooLong`.

**`subscribe`** (3):
- Re-subscribe on active sub → `expiry_time` extended by 30 days.
- Re-subscribe after expiry → new period starts.
- `subscription_price = 0` at publish → `ZeroPrice` (tested at publish, not subscribe).

### Running the suite

```bash
cd programs
cargo test -p slp                 # inline math unit tests
cargo test --test golden_flow     # LiteSVM golden path
cargo test --test adversarial     # LiteSVM adversarial
cargo test                        # all
```

Expected: <5 seconds total, no network, no validator.

## Verification

1. `cd programs && cargo build -p slp --release` produces `slp.so` without warnings.
2. `anchor build` succeeds and regenerates `target/idl/slp.json`.
3. `cargo test` — all ~40 tests pass.
4. Spot-check: in a REPL or debug test, compute PRD demo numbers from raw math and confirm they match both the Rust implementation and the Slice 1 TS implementation.
5. No changes to the Next.js tree; `pnpm build` in the repo root still succeeds; `pnpm test` still green.

## Non-goals

- Devnet or mainnet deployment.
- TypeScript client generation (Codama / `@coral-xyz/anchor`).
- Frontend rewiring (Slice 1's mock API routes remain authoritative).
- Real AI Judge service (still the deterministic mock from Slice 1).
- Real Lit / Irys / Arweave.
- Compute-budget optimization or CU measurement.
- Program upgrade authority / governance.
- Multi-judge voting, staking, slashing (roadmap).

## Next slice after this ships

With Slice 2 producing a tested `slp` program + IDL, Slice 3 is the integration slice:

1. Deploy `slp` to devnet.
2. Run Codama to generate a typed TS client under `web/src/client/slp/`.
3. Replace the Next.js API routes (`app/api/skills/*`, `app/api/experiences/*`, etc.) with client calls.
4. Wire Phantom's `signTransaction` for real transactions (today it only signs messages).
5. Update `/console` to drive real transactions; keep `DEMO_MODE` for persona impersonation via devnet keypairs.

Slices 4 and 5 (real Judge service, real Lit/Irys, off-chain indexer) remain unchanged.
