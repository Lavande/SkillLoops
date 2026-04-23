# Skill Loops Protocol (SLP) — Hackathon MVP PRD

> **Project**: Skill Loops Protocol
> **Code**: SLP
> **Event**: Solana Hackathon
> **Domain**: skillloops.xyz
> **Document Status**: MVP spec, ready for build

---

## 1. Project Overview

### 1.1 One-liner

**A Solana-based protocol where every buyer of an AI agent skill is automatically a potential shareholder. Contribute usage experience to earn shares, and all subscribers share the skill's future revenue.**

The core metaphor is the **Skill Loop**: a skill is used by an agent, the agent reflects on its experience, that experience feeds back into the skill, the skill evolves, and the loop continues forever.

### 1.2 Problem

The current market for AI agent skills is broken in three ways:

**1. Skills decay after sale.** Environments drift, new edge cases emerge, LLMs update, and APIs break. A skill sold in month 1 is often half-broken by month 6. Sellers have no systematic way to keep improving it.

**2. The most valuable signal is wasted.** When a buyer's agent fails while using a skill, that failure trace is the single most valuable data point for improving the skill — far more valuable than synthetic test cases. Today, this signal is thrown away.

**3. Buyer and seller interests diverge after purchase.** Once the transaction closes, the buyer has no stake in the skill's future. The relationship is zero-sum.

### 1.3 Key Innovations

- **Buying is opting into ownership, at zero shares.** Every subscriber gets a share account with 0 shares at purchase. If they never contribute, they stay at 0 — it's just a subscription. If they contribute useful experience, their shares grow.
- **Shares are minted, not transferred.** The author is never involuntarily diluted below a floor they set. Contributors grow the pie instead of taking from the author.
- **AI judges evaluate AI contributions to AI skills.** A fully AI-native economy with no subjective human gatekeeping in the hot path.
- **The client is a skill.** Instead of shipping an SDK, the protocol's reflection logic is itself packaged as a SKILL.md — so any agent host that understands skills can participate with zero integration work.

### 1.4 MVP Scope

This document defines the minimum viable version for a hackathon demo. The goal is to show **a complete loop live on stage in under 3 minutes**: publish → subscribe → use → reflect → submit → judge → mint shares → distribute revenue.

**In scope**: all five Solana programs, a single AI Judge service, Lit Protocol gating, Irys storage, the Reflection Skill, and a web dashboard.

**Out of scope (documented in the roadmap)**: multi-judge voting, regression test execution, zkVM verification, DAO arbitration, secondary markets for shares.

---

## 2. Users and Scenarios

### 2.1 Roles

| Role | Description | In demo |
|------|-------------|---------|
| **Skill Author** | Creator who publishes a skill | 1 wallet (Alice) |
| **Agent Operator** | Developer whose agent subscribes to skills | 2 wallets (Bob, Carol) |
| **AI Judge** | Autonomous service that scores experience contributions | 1 service (protocol-run) |

### 2.2 Canonical Scenario

We'll anchor the entire PRD around a single, relatable example: a **"GitHub PR Review" skill**.

**Publish.** Alice is a senior engineer. She has developed a strong SKILL.md that walks an agent through reviewing a pull request — checking for missing tests, security smells, stylistic issues, and giving a structured review comment. She publishes it at `skillloops.xyz/publish` for 0.1 SOL/month.

**Subscribe.** Bob runs an AI coding assistant for a startup. He subscribes to Alice's skill so his agent can auto-review PRs. He also downloads SLP's free **Reflection Skill** and loads both into his Claude Desktop.

**Use & fail.** Bob's agent reviews a PR written in Rust that uses `unsafe` blocks. Alice's skill was mainly written with JavaScript/Python in mind, and the review completely misses the safety implications of the `unsafe` code. The agent produces a shallow review.

**Reflect.** Bob's agent invokes the Reflection Skill. It analyzes the trace, identifies the root cause ("the skill has no branch for language-specific safety concerns"), drafts a concrete patch ("add a Step 2.5: if the PR is in Rust, check for `unsafe` blocks and evaluate each one"), writes a test case, and outputs a structured ExperienceBundle JSON. It tells Bob: "Go to skillloops.xyz/submit to finalize your contribution."

**Submit.** Bob opens the web app, pastes the JSON, signs two Phantom prompts (Irys upload, then Solana transaction). Within a minute, the AI Judge evaluates the bundle and scores it 38/50. The contract mints 380 shares for Bob. Alice's share goes from 100% to 72.5%.

**Distribute.** Carol subscribes the next day. Her 0.1 SOL enters the revenue pool. When the period settles, Alice claims 72.5% and Bob claims 27.5%. Carol, who has only subscribed and not contributed, gets nothing — she's a 0-share shareholder.

**Evolve.** Alice reviews Bob's contribution, agrees with the patch, and publishes v1.1 of the skill. Bob is recorded forever in that version's contributor list. The loop has closed.

---

## 3. System Architecture

### 3.1 High-level diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  USER'S AGENT ENVIRONMENT (Claude Desktop, Cursor, any host)     │
│                                                                   │
│  Skills loaded:                                                   │
│  - Target skill (Alice's "PR Review", decrypted after subscribe)  │
│  - SLP Reflection Skill (free, public)                            │
│                                                                   │
│  Agent runs task → fails/underperforms → Reflection Skill fires  │
│    → produces ExperienceBundle JSON                               │
│    → instructs user: "go to skillloops.xyz/submit"                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  WEB APP — skillloops.xyz (Next.js, browser)                      │
│                                                                   │
│  /submit flow:                                                    │
│    paste ExperienceBundle                                         │
│      → Phantom signs Irys upload (< 100 KB = free)                │
│      → Phantom signs Solana submit_experience tx                  │
│      → ExperienceRecord on-chain, status = Pending                │
│                                                                   │
│  Other routes: /market, /skill/[id], /publish, /me, /console      │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼──────────────────────┐
          ▼                   ▼                       ▼
┌──────────────────┐ ┌───────────────────┐  ┌──────────────────┐
│  AI JUDGE        │ │  SOLANA PROGRAMS  │  │  STORAGE LAYER   │
│  (Node service)  │ │  (Anchor, 5 prog) │  │                  │
│                  │ │                   │  │  Irys → Arweave  │
│  watches events  │ │  SkillRegistry    │  │  permanent       │
│  → fetches from  │◄┤  Subscription     │  │  skill files +   │
│    Arweave       │ │  ShareLedger      │  │  experiences     │
│  → Claude API    │ │  Experience       │  │                  │
│  → writes score  │─►  RevenuePool     │  │                  │
│                  │ │                   │  │                  │
└──────────────────┘ └───────────────────┘  └──────────────────┘
                              │
                              ▼
                  ┌──────────────────────────┐
                  │  LIT PROTOCOL             │
                  │  (subscriber-gated keys)  │
                  └──────────────────────────┘
```

### 3.2 Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Smart contracts | Anchor (Rust) on Solana Devnet | 5 programs |
| Permanent storage | **Irys → Arweave** | Solana-native pay, < 100 KB free |
| Content gating | Lit Protocol | Access-controlled decryption |
| AI Judge | Anthropic Claude API (claude-opus-4-7) | single judge for MVP |
| Agent client | **Reflection Skill (SKILL.md)** | no SDK needed |
| Frontend | Next.js 14 + Tailwind + shadcn/ui | |
| Wallet | Solana Wallet Adapter (Phantom / Backpack) | |
| Irys | `@irys/web-upload` + `@irys/web-upload-solana` | browser-side signing |

### 3.3 Three key architecture decisions

#### Decision 1 — Reflection Skill instead of an SDK

The client logic is not shipped as a TypeScript or Python SDK. It's packaged as a `SKILL.md` file that any agent host can load.

**Why**: (a) every major agent framework that supports skills works out of the box; (b) the protocol dogfoods its own primitive, which is a strong narrative; (c) zero SDK maintenance burden across languages and frameworks; (d) the Reflection Skill itself can eventually be hosted *on SLP* and evolve through its own mechanism — a recursive self-bootstrapping loop.

**Division of labor**:
- **Reflection Skill** does the *thinking*: trace analysis, root cause, patch drafting, test case design, JSON assembly.
- **Web App** does the *signing*: Irys upload, Solana transactions, Phantom interactions.

#### Decision 2 — Irys for storage

We use Irys (formerly Bundlr) rather than native Arweave.

**Why**: Irys accepts SOL as payment, uploads confirm in seconds (native Arweave takes minutes, which is unworkable during a live demo), and files under 100 KB are free. Files are ultimately settled onto Arweave, giving us the same permanence.

**Cost profile**:

| Data | Typical size | Cost |
|------|--------------|------|
| ExperienceBundle JSON | ~5 KB | free |
| Encrypted skill file | ~70 KB | free |
| Large skill with embedded examples | ~200 KB | ~$0.0015 |
| Judge score report | ~3 KB | free |

For the MVP, **storage cost is effectively zero**.

#### Decision 3 — All wallet signing happens in the browser

The Reflection Skill never asks for a signature. It produces a JSON blob and directs the user to the web app. Phantom integration lives entirely on skillloops.xyz.

**Why**: Phantom's native surface is the browser. Trying to wire a signing flow through an arbitrary agent host is fragile. Keeping signing in the web app also gives us the classic "Phantom popup → user clicks Approve" beat during the demo, which is much more convincing than a silent automated transaction.

---

## 4. Data Model

### 4.1 On-chain accounts (Solana PDAs)

#### `SkillRegistry` — skill metadata

```rust
#[account]
pub struct SkillRegistry {
    pub skill_id: Pubkey,
    pub author: Pubkey,
    pub name: String,                   // max 64
    pub description: String,            // max 256
    pub category: String,               // max 32
    pub current_version: u32,
    pub content_hash: [u8; 32],         // sha256 of current version content
    pub arweave_tx_id: String,          // Irys/Arweave tx id, max 64
    pub subscription_price: u64,        // lamports per 30 days
    pub created_at: i64,
    pub updated_at: i64,
    pub subscriber_count: u32,
    pub total_revenue: u64,
}
```

#### `Subscription` — usage rights

```rust
#[account]
pub struct Subscription {
    pub subscriber: Pubkey,
    pub skill_id: Pubkey,
    pub start_time: i64,
    pub expiry_time: i64,
    pub total_calls: u64,               // optional, for stats
    pub is_active: bool,
}
```

#### `ShareLedger` — per-skill share registry

```rust
#[account]
pub struct ShareLedger {
    pub skill_id: Pubkey,
    pub total_shares: u64,
    pub author_shares: u64,
    pub min_author_ratio_bps: u16,      // hard floor 3000 (30%),
                                         // author may raise above this
    pub contributor_count: u32,
    pub last_snapshot_time: i64,
}
```

#### `ShareAccount` — one holder's stake in one skill

```rust
#[account]
pub struct ShareAccount {
    pub holder: Pubkey,
    pub skill_id: Pubkey,
    pub shares: u64,
    pub lock_until: i64,                // 6-month lock after each mint
    pub first_contribution_at: i64,
    pub last_contribution_at: i64,
}
```

#### `ExperienceRecord` — a submitted contribution

```rust
#[account]
pub struct ExperienceRecord {
    pub experience_id: u64,
    pub skill_id: Pubkey,
    pub contributor: Pubkey,
    pub skill_version: u32,
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,
    pub status: ExperienceStatus,       // Pending / Evaluated / Rejected
    pub contribution_score: u8,         // 0..=50
    pub shares_minted: u64,
    pub submitted_at: i64,
    pub evaluated_at: i64,
    pub judge_signature: [u8; 64],
}

pub enum ExperienceStatus { Pending, Evaluated, Rejected }
```

#### `RevenuePool` — subscription revenue accumulator

```rust
#[account]
pub struct RevenuePool {
    pub skill_id: Pubkey,
    pub current_period_revenue: u64,
    pub total_lifetime_revenue: u64,
    pub current_period_start: i64,
    pub period_length: i64,             // 300s for demo, 30 days in prod
    pub snapshot_total_shares: u64,
    pub last_settlement_time: i64,
}
```

#### `ClaimableRevenue` — a holder's pending payout

```rust
#[account]
pub struct ClaimableRevenue {
    pub holder: Pubkey,
    pub skill_id: Pubkey,
    pub amount: u64,
    pub snapshot_id: u64,
}
```

### 4.2 Off-chain data (stored on Arweave via Irys)

#### ExperienceBundle schema

```json
{
  "version": "1.0",
  "skill_id": "pubkey_base58",
  "skill_version": 1,
  "trace_id": "uuid",
  "submitted_at": 1714000000,

  "context": {
    "task_description": "Review this pull request",
    "input_summary": "Rust PR introducing an unsafe block in the allocator path"
  },

  "trajectory": [
    {
      "step": 1,
      "action": "detect_language",
      "observation": "primary language: Rust",
      "result": "ok"
    },
    {
      "step": 2,
      "action": "review_for_common_smells",
      "observation": "no style issues found; no missing tests flagged",
      "result": "ok"
    },
    {
      "step": 3,
      "action": "produce_review",
      "observation": "review delivered but makes no mention of unsafe block safety",
      "result": "missed_critical_issue"
    }
  ],

  "outcome": "partial",
  "failure_mode": "language_specific_safety_not_covered",
  "root_cause_analysis": "The skill's review checklist is language-agnostic and has no branch for Rust-specific concerns. `unsafe` blocks carry strong invariants (valid pointers, aliasing, etc.) and not flagging them defeats the purpose of review.",

  "lesson_learned": "Skills for code review need language-aware branches. For Rust, the agent should specifically audit `unsafe` blocks, explain why each one is needed, and check the invariants the author is implicitly claiming to uphold.",

  "proposed_patch": {
    "type": "new_step",
    "target_section": "after Step 2 (common smell check), before Step 3 (produce review)",
    "diff": "+ Step 2.5: Language-specific safety audit.\n+   If the PR contains Rust code:\n+     - Locate all `unsafe` blocks.\n+     - For each, explain the invariant the author must uphold.\n+     - Flag any block where the invariant is not obviously satisfied.\n+   If the PR contains C/C++, apply analogous manual-memory-management checks."
  },

  "test_case": {
    "input_pr_diff": "diff --git a/src/alloc.rs ...\n+ unsafe { ptr::write(dst, value); }",
    "expected_review_must_contain": "unsafe block: you are claiming `dst` is valid, aligned, and not aliased"
  },

  "generated_by_reflection_skill_version": "1.0.0"
}
```

Note: no explicit `submitted_by` signature is needed — the Solana transaction that registers the record is itself signed by the contributor.

#### AI Judge score report (also stored on Arweave)

```json
{
  "experience_id": 42,
  "judged_at": 1714000120,
  "judge_id": "slp-judge-claude-opus-4-7-v1",

  "scores": {
    "novelty": 8,
    "specificity": 9,
    "actionability": 8,
    "reproducibility": 7,
    "impact": 6
  },
  "weighted_total": 38,

  "reasoning": {
    "novelty": "No prior experience in this skill's history covers Rust-specific safety auditing. Recognized pattern only covers generic smell checks.",
    "specificity": "Clear trace with identifiable failure point at step 3.",
    "actionability": "The proposed patch specifies exact insertion point and concrete behavior. Author can merge with minor editing.",
    "reproducibility": "Test case includes an exact diff snippet and a must-contain assertion; reproducible with minor setup.",
    "impact": "Affects every Rust PR reviewed by this skill — a meaningful fraction of target usage."
  },

  "duplicate_check": {
    "is_duplicate": false,
    "similarity_to_existing": 0.14
  },

  "recommendation": "APPROVE"
}
```

---

## 5. Core Modules

### 5.1 Skill Publication

Alice navigates to `/publish`, fills in metadata, uploads her SKILL.md, sets price and share-floor parameters.

1. Frontend generates a Lit Protocol access condition: "wallet must hold a valid Subscription for this skill."
2. Skill file is encrypted by Lit and uploaded to Arweave via Irys (Phantom signs an Irys message).
3. Alice signs a Solana transaction that creates `SkillRegistry`, `ShareLedger`, `RevenuePool`.
4. `ShareLedger` initializes with `total_shares = 1000`, all held by Alice (100%).

**Configurable parameters**:
- `min_author_ratio_bps` — author's protected floor. Hard-coded minimum is 3000 (30%); Alice may set it higher.
- `contribution_coefficient_k` — shares minted per score point. Default 10.

**Acceptance criteria**:
- [ ] Publish transaction succeeds, `SkillRegistry` queryable on-chain.
- [ ] Arweave tx id resolves to encrypted content.
- [ ] `ShareLedger` shows Alice at 1000 / 1000 shares.

### 5.2 Subscription

Bob visits the skill detail page, clicks subscribe, Phantom prompts for 0.1 SOL.

1. SOL lands in `RevenuePool.current_period_revenue`.
2. `Subscription` created with 30-day expiry.
3. `ShareAccount` created with `shares = 0`.
4. Frontend requests a decryption key from Lit; caches it in IndexedDB.
5. `SkillRegistry.subscriber_count++`.

Bob's `ShareAccount` is the subtle-but-critical piece: **he is registered as a shareholder from the moment of purchase, just with zero equity**. This is the data-structure embodiment of "buying is opting in."

**Acceptance criteria**:
- [ ] Post-subscribe, Bob can decrypt and download the skill file.
- [ ] A non-subscriber's wallet cannot get a decryption key from Lit.
- [ ] 0.1 SOL is in the revenue pool.
- [ ] `ShareAccount` exists with `shares = 0`.

### 5.3 Reflection Skill (the client)

The Reflection Skill is a free, public skill maintained by the protocol. Subscribers download it from `/reflection-skill` and load it into their agent host alongside whatever target skill they're using.

#### What it does

Given a trace of the agent using a target skill, the Reflection Skill guides the agent through producing a high-quality ExperienceBundle. It is the protocol's *metacognition for skills*.

#### Trigger conditions

The skill should activate when:
- the target skill task failed or produced a clearly inferior result,
- the user explicitly requests feedback for the skill,
- the agent itself detects a gap in the target skill's coverage.

It explicitly should **not** activate when the task completed smoothly — submitting "everything was fine" creates spam that the Judge will reject anyway.

#### The six-step protocol

1. **Gather context** — pull the target skill's id and version (from subscription metadata), the original task, and the full trajectory from conversation history.
2. **Root-cause analyze** — don't just describe *what* failed; explain *why the skill allowed it to fail*. Is it a missing branch? A wrong default? An outdated assumption about the environment?
3. **Draft a patch** — produce a concrete, merge-ready modification to the target skill. Specify the type (new step, prompt addition, example addition, etc.), the section, and the exact text.
4. **Design a test case** — one reproducible example: input, what the old skill did, what the fixed skill should do.
5. **Self-check** — the skill prompts the agent to honestly evaluate: is this novel? Is the patch specific? Is the test reproducible? Does this deserve a gas fee? If any answer is no, recommend *not* submitting.
6. **Deliver** — output the JSON and instruct the user: "Go to `skillloops.xyz/submit`, connect Phantom, paste this JSON."

#### SKILL.md skeleton

A trimmed version of the actual file:

```markdown
# SLP Reflection Skill v1.0.0

## Purpose
After using a skill subscribed via Skill Loops Protocol, invoke this skill
to produce a structured experience contribution. High-quality contributions
earn you shares in the target skill.

## When to use
- Task failed or produced a clearly inferior result.
- You notice an obvious gap in the target skill.
- User explicitly asks to give feedback.

## When NOT to use
- Task completed smoothly. Do not submit "no issues."
- You don't have a concrete patch or test case in mind.

## Steps
### 1. Gather context
From the conversation history, extract:
- target skill id and version
- the original task
- the full action/observation trajectory
- the final outcome

### 2. Root-cause analysis
Ask: why did the *skill* allow this to happen? Don't describe the symptom;
describe the missing capability in the skill.

### 3. Propose a patch
Produce a concrete modification. Specify:
- patch type (new_step | prompt_addition | example_addition | ...)
- target section
- exact text to insert or change

### 4. Design a test case
- minimal reproducing input
- expected output from the fixed skill

### 5. Self-check
Answer honestly:
- Has this already been fixed in a recent version?
- Is the patch merge-ready?
- Is the test reproducible?
- Is this worth a wallet signature?
If any answer is no → recommend skipping submission.

### 6. Output and deliver
Output the ExperienceBundle JSON below, then:

> Go to https://skillloops.xyz/submit
> Connect your Phantom wallet
> Paste the JSON to finalize
> Approximate time: 30 seconds. Storage is free under 100 KB.

## ExperienceBundle schema
{ ... see PRD section 4.2 ... }

## Scoring hints
The AI Judge scores five dimensions (0-10 each):
- Novelty, Specificity, Actionability, Reproducibility, Impact
Aim for ≥7 on each. If you can't, the experience probably isn't ready.
```

**Why this is powerful**:

- It is the *first* skill on SLP (even before any third-party publishes), and eventually it will be hosted on SLP itself — earning shares for those who contribute experiences about it. The Reflection Skill improving itself is the most literal demonstration of what the protocol enables.
- It also has standalone value: even a user who doesn't care about SLP's tokenomics can load this skill to get better post-mortems out of their agent.

**Acceptance criteria**:
- [ ] SKILL.md loads cleanly in Claude Desktop and Cursor.
- [ ] On a real failed task, the produced JSON validates against the schema.
- [ ] The output explicitly tells the user to go to `skillloops.xyz/submit`.

### 5.4 Web Submission Flow

The `/submit` page is where the experience becomes a transaction.

**Flow**:

1. User pastes the ExperienceBundle JSON.
2. Frontend validates:
   - schema compliance,
   - `skill_id` corresponds to an active Subscription owned by the connected wallet,
   - `submitted_by` equivalent (the connected wallet) makes sense.
3. User clicks Submit.
4. **Phantom popup 1** — Irys signature for upload. JSON uploads to Arweave (free, < 100 KB). Returns `arweave_tx_id`.
5. **Phantom popup 2** — Solana transaction. `submit_experience(skill_id, arweave_tx_id, content_hash)` creates an `ExperienceRecord` with status `Pending`.
6. User is redirected to `/me/contributions` which live-polls for the Judge's verdict.

**Example frontend code**:

```typescript
import { WebUploader } from "@irys/web-upload";
import { WebSolana } from "@irys/web-upload-solana";

async function submitExperience(bundleJson: string, wallet: Wallet) {
  const irys = await WebUploader(WebSolana).withProvider(wallet).devnet();
  const tags = [
    { name: "Content-Type", value: "application/json" },
    { name: "Protocol",     value: "SLP" },
    { name: "Type",         value: "ExperienceBundle" },
  ];
  const receipt = await irys.upload(bundleJson, { tags });

  const contentHash = sha256(bundleJson);
  const tx = await program.methods
    .submitExperience(receipt.id, Array.from(contentHash))
    .accounts({ ... })
    .rpc();

  return { arweaveTxId: receipt.id, solanaTx: tx };
}
```

**Acceptance criteria**:
- [ ] Invalid JSON rejected with clear error.
- [ ] Two-step signing flow completes smoothly.
- [ ] `ExperienceRecord` created on-chain with correct fields.
- [ ] Redirect and polling display the Judge's verdict when it arrives.

### 5.5 AI Judge Service

A Node.js service runs with the protocol's judge keypair. It subscribes to Solana program events and processes any new `ExperienceRecord` with status `Pending`.

**Flow**:

1. Detect new `Pending` record.
2. Fetch the ExperienceBundle from Arweave using `arweave_tx_id`.
3. Run a duplicate check against an embedding store of past contributions for this skill.
4. Call Claude API with the Judge prompt (below).
5. Parse the JSON response, sign it with the judge key.
6. Upload the full score report to Arweave (for auditability).
7. Call `evaluate_experience` on the `Experience` program, which triggers `mint_contribution_shares` if the score is high enough.

#### Judge prompt (condensed)

```
You are the AI Judge for Skill Loops Protocol. You score experience
contributions that buyers submit for AI agent skills. Your scores must
be consistent, severe, and reproducible.

Score each of five dimensions 0–10:

NOVELTY — does this reveal a new blind spot?
  0–2: duplicate of prior contributions.
  3–5: mostly known, minor angle.
  6–8: clear new issue.
  9–10: opens a significant unseen category.

SPECIFICITY — how concrete is the description?
  0–2: vague.
  3–5: partial.
  6–8: clear input, failure point, error.
  9–10: every step traceable.

ACTIONABILITY — can the patch be merged?
  0–2: diagnosis only.
  3–5: vague direction.
  6–8: concrete diff.
  9–10: merge-ready.

REPRODUCIBILITY — can someone else reproduce this?
  0–2: not reproducible.
  3–5: needs work.
  6–8: reproducible with some effort.
  9–10: fully specified.

IMPACT — how broad is the issue?
  0–2: exotic corner case.
  3–5: niche.
  6–8: meaningful slice of users.
  9–10: universal.

Total = 1.2·novelty + 1.0·specificity + 1.2·actionability
      + 0.8·reproducibility + 0.8·impact    (max 50)

Prior experiences for this skill (for duplicate detection):
[ ... summaries ... ]

Experience under review:
[ ... full ExperienceBundle ... ]

Respond with strict JSON only:
{
  "scores": { "novelty": N, ... },
  "weighted_total": N,
  "reasoning": { "novelty": "...", ... },
  "duplicate_check": { "is_duplicate": bool, "similarity_to_existing": 0..1 },
  "recommendation": "APPROVE" | "REJECT"
}
```

**MVP security notes** (explicitly called out for pitch):
- Single Judge, single key — trust assumption we are aware of.
- Every score report is uploaded to Arweave, making the Judge's reasoning permanently auditable. Even if someone tries to slander the Judge later, the on-chain + Arweave trail is complete.
- Roadmap: multi-judge voting, staking, slashing.

**Acceptance criteria**:
- [ ] Median latency from `Pending` to `Evaluated` under 60 seconds.
- [ ] Score report reproducible on Arweave.
- [ ] Below threshold → status flips to `Rejected`, no shares minted.

### 5.6 Share Minting

When `evaluate_experience` runs with a score above threshold, the contract mints shares.

**Formula**:

```
base_shares = score × k                               (k default 10)

max_new_preserving_floor =
    (author_shares × 10000 / min_author_ratio_bps) - total_shares

actual_new = min(base_shares, max_new_preserving_floor)
```

In plain language: we want to mint `score × k` shares, but we cap the mint so the author's percentage never drops below their floor. Author's absolute share count never decreases; only the percentage changes, and only until the floor.

**Reference implementation**:

```rust
pub fn mint_contribution_shares(
    ctx: Context<MintShares>,
    experience_id: u64,
    contribution_score: u8,
) -> Result<()> {
    let ledger = &mut ctx.accounts.share_ledger;
    let experience = &mut ctx.accounts.experience_record;
    let share_account = &mut ctx.accounts.contributor_share_account;

    require!(experience.status == ExperienceStatus::Pending);
    require!(contribution_score >= MIN_APPROVE_SCORE);  // e.g. 20

    let k: u64 = 10;
    let base_shares = (contribution_score as u64) * k;

    let min_ratio_bps = ledger.min_author_ratio_bps as u64;
    let max_total = ledger.author_shares
        .checked_mul(10_000).unwrap()
        .checked_div(min_ratio_bps).unwrap();
    let max_new = max_total.saturating_sub(ledger.total_shares);

    let actual_new = base_shares.min(max_new);

    ledger.total_shares += actual_new;
    share_account.shares += actual_new;
    share_account.last_contribution_at = Clock::get()?.unix_timestamp;
    share_account.lock_until = Clock::get()?.unix_timestamp + LOCK_PERIOD_SECONDS;

    experience.status = ExperienceStatus::Evaluated;
    experience.contribution_score = contribution_score;
    experience.shares_minted = actual_new;

    emit!(SharesMinted { ... });
    Ok(())
}
```

**Acceptance criteria**:
- [ ] High score mints shares; post-mint author ratio ≥ floor.
- [ ] Low score rejects without minting.
- [ ] Lock timer set to 6 months (configurable for demo).

### 5.7 Revenue Distribution

Subscriptions pay into the pool continuously. The pool settles at the end of each period.

**For the demo**: `period_length = 300 seconds` (5 minutes) so settlements can be shown live. Production default is 30 days.

**Settle** — anyone can call once a period has elapsed:

```rust
pub fn settle_period(ctx: Context<SettlePeriod>) -> Result<()> {
    let pool = &mut ctx.accounts.revenue_pool;
    let ledger = &ctx.accounts.share_ledger;
    let now = Clock::get()?.unix_timestamp;

    require!(now >= pool.current_period_start + pool.period_length);

    pool.snapshot_total_shares = ledger.total_shares;

    let period_revenue = pool.current_period_revenue;
    pool.total_lifetime_revenue += period_revenue;
    pool.current_period_revenue = 0;
    pool.current_period_start = now;
    pool.last_settlement_time = now;

    emit!(PeriodSettled {
        skill_id: ledger.skill_id,
        period_revenue,
        total_shares: ledger.total_shares,
    });
    Ok(())
}
```

An off-chain indexer listens for `PeriodSettled`, iterates through all `ShareAccount`s for that skill, and creates `ClaimableRevenue` entries proportional to each holder's share. This part is intentionally off-chain for the MVP; a production version would use Merkle snapshots.

**Claim**:

```rust
pub fn claim_revenue(ctx: Context<Claim>) -> Result<()> {
    let claimable = &mut ctx.accounts.claimable;
    let amount = claimable.amount;
    require!(amount > 0);

    **ctx.accounts.pool_account.try_borrow_mut_lamports()? -= amount;
    **ctx.accounts.holder.try_borrow_mut_lamports()? += amount;

    claimable.amount = 0;
    Ok(())
}
```

**Acceptance criteria**:
- [ ] Settlement only succeeds once per period.
- [ ] Every non-zero holder gets a `ClaimableRevenue` matching their share ratio.
- [ ] Zero-share holders (like Carol in the scenario) get nothing.
- [ ] Claim transfers SOL and zeroes the entry.

### 5.8 Version Upgrade

Alice reviews evaluated experiences, picks ones she wants to incorporate, edits her SKILL.md, and publishes v1.1.

1. Alice selects evaluated `ExperienceRecord`s from the dashboard.
2. She edits the skill file locally (MVP does not auto-generate patches).
3. Uploads the new version via Irys.
4. Calls `publish_new_version`, which bumps `current_version` and records the contributing experience ids.
5. Existing subscribers automatically get access to the new version (Lit access condition is unchanged).

**Acceptance criteria**:
- [ ] Version number increments correctly.
- [ ] Existing subscribers can decrypt the new version.
- [ ] Contributor list is permanently associated with the version.

### 5.9 Frontend

**Routes**:

- `/market` — grid of skills with name, category, subscribers, shareholder count, price.
- `/skill/[id]` — detail view.
  - Public: metadata, subscribe button, share distribution pie chart, contribution timeline, revenue history bar chart.
  - Subscribers also see: skill content preview and a **Download Skill** button.
  - Shareholders also see: the content of other contributors' experience bundles.
- `/publish` — Alice's publishing form.
- `/submit` — paste-and-sign page for experience submission.
- `/me` — the user's dashboard: published skills, subscriptions, share holdings, claimable revenue, contributions history.
- `/reflection-skill` — one-click download for the Reflection Skill, plus a quick "how to load this into Claude Desktop / Cursor" guide.
- `/console` — **the demo-day page**. A scripted end-to-end scenario that shows an agent running the target skill, failing, invoking the Reflection Skill, producing JSON, submitting it, and showing the share pie shift in real time.

**Visual identity**:

- Dark theme, monospaced accents.
- Signature motif: a **Skill Loop** animation — a closed circular flow (use → reflect → submit → evolve → use) that completes one full rotation each time a contribution is accepted.
- Share pie chart with smooth wedge animations when new shares are minted.

---

## 6. Demo Script (3 minutes)

### Act 1 — Publish (30s)
Alice connects Phantom at `/publish`. She uploads her "GitHub PR Review" SKILL.md, sets price to 0.1 SOL/month and author floor to 40%. She signs two prompts: Irys upload, then Solana transaction. The detail page loads: Alice holds 1000/1000 shares (100%).

### Act 2 — Subscribe and prepare (30s)
Switch to Bob's wallet. Bob subscribes. We show his `ShareAccount`: 0 shares, but he's now on the cap table. Bob downloads the skill file (decrypted via Lit) and also grabs the Reflection Skill from `/reflection-skill`.

### Act 3 — Use the skill inside Claude Desktop (60s)
**The live highlight.** Switch to Claude Desktop (or `/console` if Desktop is flaky). Both skills are loaded. Bob pastes a Rust PR diff that introduces an `unsafe` block. The agent runs Alice's skill, produces a shallow review that doesn't mention `unsafe`. Bob asks the agent to reflect. The Reflection Skill fires: root cause analysis, proposed patch (add a Rust-safety branch), test case, final JSON. The agent ends with: "Go to skillloops.xyz/submit."

### Act 4 — Submit and be judged (40s)
Bob switches to the browser, pastes the JSON at `/submit`. Phantom popup 1 (Irys), popup 2 (Solana). `ExperienceRecord` appears as Pending. Thirty seconds later, the Judge evaluates: score 38/50, APPROVE. The share pie animates: Alice 100% → 72.5%, Bob 0% → 27.5%.

### Act 5 — Subscribe and settle (30s)
Carol subscribes; her 0.1 SOL enters the pool. Someone triggers `settle_period` (we show the 5-minute period ticking or force-settle for demo pacing). Alice claims 72.5% of the pool, Bob claims 27.5%. Carol has 0 shares and receives 0 — the clean demonstration that subscription alone ≠ ownership.

### Act 6 — Evolve (20s)
Alice opens the contributions page, marks Bob's experience as "merged," publishes v1.1. The Skill Loop animation completes one full rotation on screen. Bob is permanently listed as a contributor to v1.1.

Total runtime: just under 3 minutes.

---

## 7. Build Plan

### 7.1 Team assignments (3 builders)

**Contracts engineer (Anchor / Rust)**
- [ ] Project scaffold and CI.
- [ ] Implement all 5 programs.
- [ ] Unit tests for share minting edge cases (floor protection, score thresholds, duplicate prevention).
- [ ] Devnet deployment.

**Backend / AI engineer (TypeScript + Claude)**
- [ ] Author the Reflection Skill SKILL.md and verify it runs end-to-end in Claude Desktop.
- [ ] AI Judge service: event subscription, Arweave fetch, Claude call, score signing, on-chain write.
- [ ] Irys helper library (browser and server).
- [ ] Lit Protocol integration.
- [ ] Off-chain indexer for `ClaimableRevenue` generation.

**Frontend engineer (Next.js)**
- [ ] Wallet connection, base layout, dark theme.
- [ ] `/market`, `/skill/[id]` with share pie and contribution timeline.
- [ ] `/submit` with paste-validate-sign flow.
- [ ] `/publish` and `/me`.
- [ ] `/reflection-skill` download page.
- [ ] `/console` demo page with scripted scenario.
- [ ] Skill Loop motif animation.

### 7.2 Milestones (72 hours)

| Hours | Goal |
|-------|------|
| 0–8 | Environments set up, contract skeletons, frontend shell, Reflection Skill v0 |
| 8–24 | Core contracts on Devnet, Judge calling Claude API end-to-end, Irys upload working, market page rendering real data |
| 24–48 | Full end-to-end loop integrated: publish → subscribe → submit → judge → mint → settle → claim |
| 48–60 | `/console` polish, Loop animation, share pie animations, rehearsal |
| 60–70 | Demo walkthrough recording (as backup), pitch deck, README |
| 70–72 | Buffer, final bug fixing, submission |

---

## 8. Known Limitations and Demo-Day Risks

### Limitations we acknowledge openly

- **Single Judge, trusted key.** Honest on this and have the roadmap slide ready.
- **No staking, no slashing.** No economic defense against a compromised Judge in the MVP.
- **No arbitration path.** A contributor who disagrees with a score has no appeal.
- **Off-chain snapshot batch.** Doesn't scale past a few hundred holders per skill; production needs Merkle distribution.
- **Plaintext experience storage** on Arweave (visible to subscribers, not the public). No PII redaction pipeline.
- **Reflection Skill governance.** Maintained centrally in MVP, meant to move to SLP itself in v2.

### Demo-day risks and mitigations

- **Devnet flakes** — have a local validator ready as backup.
- **Claude API latency or rate limits** — pre-warm the service, have a screen recording as last-resort fallback.
- **Lit Protocol complexity** — if blocked, downgrade to a centralized key server for the demo and call it out in the pitch.
- **Irys devnet hiccups** — keep a small amount of mainnet SOL ready as backup upload path.
- **Claude Desktop skill loading** — test exhaustively before demo; have `/console` as the purely-visual fallback.

### How to frame tradeoffs in the pitch

> "We made three explicit tradeoffs for the MVP: one Judge instead of a Judge network, periodic snapshots instead of continuous streams, plaintext storage instead of ZK privacy. Each has a concrete upgrade path in our roadmap. What we're showing today is the closed loop."

---

## 9. Roadmap

| Priority | Feature | Notes |
|----------|---------|-------|
| P0 | Multi-judge voting with stake and slash | removes single-key trust |
| P0 | Regression test engine | uses the `test_case` field to automatically verify patches |
| P0 | Host the Reflection Skill on SLP | closes the meta loop |
| P1 | Kleros-style arbitration | for contested scores |
| P1 | Secondary market for post-lock shares | liquidity for long-term contributors |
| P1 | Native Phantom deep-link for agent-initiated signing | removes the manual paste step |
| P2 | zkVM regression proofs | provable patch verification |
| P2 | One-click merge of high-scoring patches | reduces author workload |
| P2 | Cross-skill experience transfer | shared learnings between similar skills |
| P3 | Fork mechanism | contributors can fork a skill if the author won't evolve it |

---

## 10. Success Metrics

### Hard (must demonstrate)

- [ ] All five programs deployed on Devnet with full instruction coverage.
- [ ] Live 3-minute loop, no recording.
- [ ] Three real wallets participating.
- [ ] Real Claude API call producing a score.
- [ ] Reflection Skill running inside a real agent host (Claude Desktop).

### Soft (pitch goals)

- Judge can restate the core thesis in one sentence.
- At least one audible "ooh" from the audience when the share pie animates.
- The phrase "buying is opting in at zero shares" gets repeated by a judge.
- "AI skills, AI agents, AI judges — a fully AI-native economy" lands as a quotable.

---

## 11. Pitch Narrative — the four beats

1. **"Every buyer is a potential shareholder."**
   The default is zero shares. You buy, you're on the cap table, you decide whether to earn equity. This reframes the entire relationship between skill authors and skill users.

2. **"Skills that get better the more they fail."**
   Failure is the most valuable training signal, and SLP is the first protocol that turns it into an asset class.

3. **"A fully AI-native economy: AI skills, AI agents, AI judges."**
   No human gatekeeper in the hot path. This isn't AI-assisted — it's AI-settled. It's what agent-to-agent commerce will look like.

4. **"The first skill on Skill Loops is the skill that teaches other skills how to evolve."**
   The Reflection Skill is both our client and a living demonstration. It will eventually evolve on SLP itself, making it the most literal self-bootstrapping system in the agent economy.

---

## Appendix A — Glossary

| Term | Meaning |
|------|---------|
| SLP | Skill Loops Protocol |
| Skill | A packaged AI agent capability (SKILL.md and optional bundled assets) |
| Reflection Skill | The protocol's official skill that guides agents to produce structured experience bundles |
| ExperienceBundle | The structured contribution a buyer's agent produces after using a skill |
| ShareLedger | The per-skill on-chain cap table |
| RevenuePool | The per-skill accumulator for subscription payments |
| AI Judge | Autonomous service that scores experience contributions |
| Contribution Score | Judge's 0–50 score on a contribution |
| Irys | Solana-native L2 over Arweave; free under 100 KB, permanent storage |

## Appendix B — Formulas at a glance

**Share minting:**
```
Δshares = min(score × k, max_new_preserving_author_floor)
```

**Author floor protection:**
```
max_new = (author_shares × 10000 / min_author_ratio_bps) - total_shares
```

**Revenue split:**
```
claim_i = period_revenue × shares_i / total_shares_at_snapshot
```

## Appendix C — Why the Reflection Skill matters beyond SLP

The Reflection Skill is our client, but it solves a more universal problem:

> *AI agents rarely produce systematically reusable lessons from their own failures.*

Most agent frameworks include some notion of "self-reflection," but the outputs are usually unstructured prose that no one can reuse. The Reflection Skill is specifically designed to produce merge-ready, test-case-backed, schema-valid artifacts — a format any human or agent downstream can consume.

This gives it standalone value and makes it a natural top-of-funnel for SLP. A developer loads it because their agent gets better at post-mortems, notices that the skill ends by pointing to `skillloops.xyz/submit`, and is pulled into the protocol without ever having heard the term "Skill Loops" before.

That's the acquisition strategy, quietly embedded in the skill itself.