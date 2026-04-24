# Skill Loops — Web-to-Chain Wiring (Slice 3) — Design

## Context

Slice 1 shipped a self-contained Next.js frontend backed by a SQLite mock
backend. Slice 2 shipped the `slp` Anchor program (8 instructions, 9
account types, 48 LiteSVM tests passing) as a standalone crate with no
web integration. Slice 3 closes that gap: the Next.js app's mutation
paths become real Solana transactions against a devnet deployment of
`slp`, signed by real user wallets (Phantom) and dedicated persona
wallets (for the `/console` stepper demo). Read paths continue to hit
SQLite — now a projection of on-chain events, maintained by an
in-process indexer.

This slice deliberately keeps Arweave, Lit Protocol, and the AI Judge
mocked. Those swaps land in Slice 4. The goal here is to land a fully
demoable on-chain version of the Slice 1 flow, without rewriting any
page's UI.

## Scope

**In scope**
- Devnet deployment of the existing `slp` program and one-time
  `ProtocolConfig` initialization.
- `lib/chain/*` client: Anchor provider, IDL bindings, PDA helpers,
  event decoder, 8 per-instruction transaction helpers.
- `lib/indexer.ts`: in-process polling indexer that projects chain
  events into the existing SQLite schema.
- `lib/personas.ts`: persona-vault signer for `/console` demo flows.
- `lib/judge-client.ts`: mock Judge as an on-chain client (picks up
  pending experiences via indexer state, signs `evaluate_experience`
  txs with a dedicated judge keypair).
- Deletion of the 6 chain-touching POST API handlers
  (`/api/skills`, `/api/skills/:id/versions`, `/api/subscriptions`,
  `/api/experiences`, `/api/revenue/:skillId/settle`,
  `/api/revenue/:skillId/claim`) and their counterpart functions in
  `lib/services.ts`.
- New `POST /api/indexer/tick` + `GET /api/indexer/status`.
- Metadata-on-Arweave flow for `{name, description, category}`.
- `scripts/deploy-devnet.sh`, `scripts/init-protocol.ts`,
  `scripts/demo-personas.ts`, `scripts/seed-devnet.ts`.
- Vitest unit tests for PDA derivation, event decoding, tx builders,
  and projection rules.
- Playwright devnet E2E spec gated behind `SLP_DEVNET_E2E=1`.

**Out of scope (deferred, each to a named later slice)**
- Real Arweave / Irys upload → Slice 4.
- Real Lit Protocol gating → Slice 4.
- Real AI Judge (Anthropic API) → Slice 4; the daemon architecture
  ships now, the scoring function stays `lib/mock/judge.ts`.
- Upgrade-authority revocation / multi-sig → Slice 5.
- Indexer checkpointing + non-zero backfill → Slice 4+.
- Mobile polish below 1280px — stays as Slice 1 scope.
- On-chain storage of name/description/category — stays on mock
  Arweave via metadata blobs.

## Architecture

Single Next.js process, single repo. The process hosts: pages, read-side
API routes, the indexer loop, and (when `DEMO_MODE=true`) the judge
daemon. Mutations execute fully client-side as direct RPC calls to
devnet.

```
┌────────────── Next.js process ───────────────┐
│                                               │
│  Pages (Slice 1 UI, unchanged)                │
│    └── lib/api-client.ts ──GET──> /api/*       │
│    └── lib/chain/tx.ts   ──send──> devnet RPC  │
│                                    │           │
│  /api/* (reads) ──> SQLite (projection)       │
│                         ▲                      │
│  POST /api/indexer/tick ┤                      │
│                         │                      │
│  lib/indexer.ts ────────┤                      │
│    getSignaturesForAddress(PROGRAM_ID)         │
│    getTransaction(sig).meta.logMessages        │
│    BorshEventCoder.decode                      │
│    → project into existing SQLite tables       │
│    → fetch SkillMetadata from mock Arweave     │
│                                                │
│  lib/judge-client.ts (DEMO_MODE=true)          │
│    poll SQLite for Pending experiences         │
│    scoreBundle() → upload report → evaluate tx │
│                                                │
│  Mock services (Slice 1, unchanged):           │
│    lib/mock/arweave.ts, lit.ts, judge.ts       │
└───────────────────────────────────────────────┘
         │                                ▲
         │ devnet RPC (send+read)         │ events
         ▼                                │
    ┌─── Solana devnet ───┐               │
    │ slp program         │ ──────────────┘
    │ BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ │
    └──────────────────────┘
```

### Key principles

1. **Chain is authoritative; SQLite is a projection.** Any
   disagreement is resolved by nuking SQLite and re-projecting from
   sig 0. The indexer's idempotency (`indexed_signatures` table)
   makes re-projection safe and cheap.
2. **Server never signs.** All transactions are built and signed
   client-side — by Phantom (ordinary user flows) or by persona
   keypairs loaded in the browser for `/console` (demo flows) or by a
   judge keypair loaded server-side in the judge daemon (internal,
   not on behalf of any user).
3. **UI is not rewritten.** Every page still reads from `/api/*` which
   still reads SQLite. The only page-level changes are mutation call
   sites switching from `api.subscribe(...)` to
   `chain.subscribe(...)` and adding a "transaction pending /
   confirmed" affordance with Explorer links.
4. **Mock services stay.** Arweave, Lit, Judge's *scoring function*,
   Irys upload endpoints — all unchanged. This slice is about the
   on-chain wiring; off-chain services land in Slice 4.
5. **`/console` drives real transactions.** Persona impersonation
   moves from server-side header injection to client-side
   persona-keypair signing. Every `/console` beat is a real tx with a
   real Explorer link.

## Module layout

### New files

```
lib/chain/
  idl.ts                 IDL JSON import + Slp type alias (both from
                         generated sources copied into lib/chain/
                         during deploy).
  program.ts             getProgram(connection, signer) factory
                         returning Program<Slp>.
  connection.ts          Singleton devnet Connection (commitment
                         'confirmed'). Reads NEXT_PUBLIC_SOLANA_RPC.
  pdas.ts                All PDA derivations. Seeds mirror
                         programs/slp/src/state/*.rs byte-for-byte:
                         config, skill, version, ledger, pool, share,
                         subscription, experience, claim.
  events.ts              BorshEventCoder wrapper. Decodes
                         "Program data: <b64>" log lines into typed
                         event objects for all 8 event variants.
  errors.ts              parseChainError(err) → { code, message, sig }
                         mapping SlpError discriminators to UI
                         strings.
  explorer.ts            txLink(sig), accountLink(pubkey) →
                         Solana Explorer URLs (cluster-aware).
  tx.ts                  8 high-level helpers:
                           initializeProtocol, publishSkill,
                           subscribe, submitExperience,
                           evaluateExperience, publishNewVersion,
                           settlePeriod, claimRevenue
                         Each takes a Signer + typed args, returns
                         { sig }. Shared sendAndIndex() does
                         build → sign → send → confirm → tick.

lib/indexer.ts           start(), tick({ sig? }), applyEvent().
                         Idempotent via indexed_signatures table.
                         Metadata fetch from mock Arweave for
                         SkillPublished events.

lib/personas.ts          loadPersonas() → PersonaSigner[].
                         Only imported from /console routes.
                         PersonaSigner satisfies lib/chain/tx.ts's
                         Signer contract (publicKey + signTransaction).

lib/judge-client.ts      Server-only. Runs in Next.js process when
                         DEMO_MODE=true. Polls SQLite for Pending
                         experiences every 3s; calls scoreBundle();
                         uploads report to mock Arweave; sends
                         evaluate_experience tx signed by judge
                         persona.

scripts/
  deploy-devnet.sh       anchor build + cp IDL + solana program deploy
                         + init-protocol.ts (idempotent).
  init-protocol.ts       Idempotent initialize_protocol.
  demo-personas.ts       Generate + fund alice/bob/carol/judge.
                         Writes data/demo-personas.json (gitignored).
  seed-devnet.ts         Publishes 6 skills on-chain via persona
                         wallets.
```

### New API endpoints

```
POST /api/indexer/tick
  Body: { sig?: string }
  If sig provided: fetches that signature, projects its events,
  returns within the confirmed-timeout (~3s).
  If omitted: runs one catch-up pass from last_seen_sig.
  Called by client after every mutation.

GET /api/indexer/status[?verify=1]
  Without verify: { lastSeenSig, lag, running, parseFailures,
                    metadataMissing }.
  With verify=1: samples 5 random skills, reads on-chain
  ShareLedger PDAs, compares to SQLite; returns
  { ok: true } or { ok: false, mismatches: [...] }.
```

### Deleted files

```
app/api/skills/route.ts                   (POST handler only; GET stays)
app/api/skills/[id]/versions/route.ts     (entire file)
app/api/subscriptions/route.ts            (POST handler only; GET stays)
app/api/experiences/route.ts              (POST handler only)
app/api/revenue/[skillId]/settle/route.ts (entire file)
app/api/revenue/[skillId]/claim/route.ts  (entire file)
```

### Modified files

```
lib/services.ts     Delete: publishSkill, publishNewVersion, subscribe,
                    submitExperience, evaluatePending, settleRevenue,
                    claimRevenue. Keep: sha256Hex, getSolBalance
                    (rewritten to use RPC getBalance), getPeriodLengthSeconds.
lib/api-client.ts   Delete: publish, subscribe, submitExperience, settle,
                    claim (these now live in lib/chain/tx.ts).
                    Keep: listSkills, skill, experience, me, seed,
                    uploadIrys, fetchIrys, litDecrypt, consoleStep,
                    judgeTick (repurposed: now kicks the judge daemon's
                    evaluate loop instead of calling evaluatePending).
                    Add: indexerTick(sig?), indexerStatus(verify?).
lib/db.ts           Add migrations for indexer_state,
                    indexed_signatures tables. Keep existing schema.
app/publish/page.tsx       Swap api.publish → chain.publishSkill.
app/skill/[id]/page.tsx    Swap api.subscribe/api.settle/api.claim →
                           chain equivalents. Add Explorer links.
app/submit/page.tsx        Swap api.submitExperience → chain version.
app/console/page.tsx       Switch persona impersonation from server
                           header to PersonaSigner-backed client calls.
app/layout.tsx             Ensure indexer + judge daemon start on server
                           boot via lib/bootstrap.ts side-effect import.
app/api/me/route.ts        Swap balances-table lookup for
                           connection.getBalance(holder) RPC call.
app/api/judge/tick/route.ts
                           Kick the judge daemon's evaluate loop
                           (instead of Slice 1's evaluatePending()).
Anchor.toml                cluster = "Devnet", anchor_version = "0.31.1".
                           (Slice 2 uses plain `cargo test` which
                           ignores Anchor.toml, so this does not
                           affect the 48 LiteSVM tests.)
```

## Data model

The existing SQLite schema is kept as-is. Two new tables for indexer
bookkeeping:

```sql
CREATE TABLE IF NOT EXISTS indexer_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_seen_sig TEXT,
  last_seen_slot INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS indexed_signatures (
  signature TEXT PRIMARY KEY,
  slot INTEGER NOT NULL,
  status TEXT NOT NULL,         -- 'ok', 'errored', 'parse_failed', 'metadata_missing'
  error_code TEXT,              -- populated when status != 'ok'
  processed_at INTEGER NOT NULL
);
```

`balances` (from Slice 1) is orphaned — no code reads or writes it
after this slice. On-chain claims move real lamports; the UI header
balance comes from `connection.getBalance(pubkey)` via the rewritten
`getSolBalance()`. The table is left in the schema (cheap) and
removed in Slice 4.

## Event → projection mapping

One handler per event. All writes live inside a single SQLite
transaction per signature, along with the `indexed_signatures` insert
(idempotency guard).

| Event | Tables written |
|---|---|
| `SkillPublished` | Fetch `SkillMetadata` blob from mock Arweave (via `MetadataTxId` tag on content blob). Insert `skills` with `{name,description,category}` from metadata + chain fields. Insert `skill_versions` v1. Insert `share_ledgers`. Insert `share_accounts(author, 1000)`. Insert `revenue_pools`. |
| `Subscribed` | Upsert `subscriptions`. Upsert `share_accounts(subscriber, 0)`. If new subscription: `skills.subscriber_count += 1`. `skills.total_revenue += price`. `revenue_pools.current_period_revenue += price`. |
| `ExperienceSubmitted` | Insert `experiences` row (status='Pending'). `bundle_json` fetched from mock Arweave. |
| `ExperienceEvaluated` | Update `experiences`: status, score, judge_report_tx_id, evaluated_at. Status is `Evaluated` if score ≥ MIN_APPROVE else `Rejected`. |
| `SharesMinted` | Update `share_ledgers.total_shares`. If new contributor, `contributor_count += 1`. Upsert `share_accounts`: add shares, set lock_until = timestamp + 180d, COALESCE first_contribution_at, update last_contribution_at. Update `experiences.shares_minted`. |
| `PeriodSettled` | Insert `revenue_history`. Update `revenue_pools` to new period. Fetch `ClaimableRevenue` PDAs via `getProgramAccounts` (filtered by discriminator + skill_id memcmp); upsert `claimable_revenue` per holder. |
| `RevenueClaimed` | Zero out `claimable_revenue` rows for (holder, skill_id). |
| `VersionPublished` | Insert `skill_versions`. Update `skills.current_version`, `content_hash`, `arweave_tx_id`, `updated_at`. `contributing_experience_ids` decoded from the transaction's instruction data via Anchor's `BorshInstructionCoder` (not the event payload, which omits the list to stay under log-size limits). |

## Transaction flow

All 8 instruction helpers in `lib/chain/tx.ts` follow one shape via a
shared `sendAndIndex` helper:

```ts
async function sendAndIndex(
  connection, signer,
  instructions, extraSigners = []
): Promise<{ sig }> {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({
    feePayer: signer.publicKey, blockhash, lastValidBlockHeight,
  });
  tx.add(...instructions);
  extraSigners.forEach(kp => tx.partialSign(kp));
  const signed = await signer.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
  await fetch('/api/indexer/tick', {
    method: 'POST',
    body: JSON.stringify({ sig }),
  });
  return { sig };
}
```

- **Fee payer:** the signer (user Phantom, persona keypair, or judge
  daemon keypair).
- **Commitment:** `confirmed` throughout — ~1–2s on devnet, ~20x
  faster than `finalized`.
- **`publishSkill` specifics:** an ephemeral `Keypair` is generated
  client-side; its pubkey is the `skill_id` seed input. It's passed
  as an `extraSigner`. Metadata + content Arweave uploads happen via
  the existing `/api/irys/upload` mock endpoint **before** building
  the tx.
- **No server-side tx construction, signing, or sending.** The only
  server RPC use is read-only, inside the indexer.

## Config + deployment

Environment (`.env.example`):

```
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_SLP_PROGRAM_ID=BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ

INDEXER_POLL_INTERVAL_MS=2000
INDEXER_AUTOSTART=true

DEMO_MODE=true
DEMO_PERSONAS_PATH=./data/demo-personas.json

DEPLOYER_KEYPAIR=~/.config/solana/slp-deployer.json
PROGRAM_KEYPAIR=./programs/target/deploy/slp-keypair.json
```

First-time setup (documented in README):

```bash
solana-keygen new --outfile ~/.config/solana/slp-deployer.json
solana config set --url devnet --keypair ~/.config/solana/slp-deployer.json
solana airdrop 5
./scripts/deploy-devnet.sh
pnpm tsx scripts/demo-personas.ts
pnpm tsx scripts/seed-devnet.ts
pnpm dev
```

Deployment script is idempotent: `anchor build` re-emits the IDL,
`solana program deploy` is a no-op on unchanged bytecode,
`init-protocol.ts` checks for the config PDA before calling.
IDL + types are copied from `programs/target/{idl,types}/slp.*` to
`lib/chain/idl-slp.json` + `lib/chain/slp.ts` on every deploy.

## Error handling

**Transaction failures** surface as typed `ChainError { code, message,
sig? }` from `lib/chain/errors.ts`. The 18 `SlpError` variants map to
user-friendly strings. Wallet rejections are a separate error class
(`SignatureDeclined`). RPC timeouts trigger one blockhash-refresh
retry.

**Indexer failures** are visible at `/api/indexer/status`:
- RPC flakes → log, retry next poll.
- `getTransaction` null → leave unindexed, retry next poll.
- Parse failure → mark `parse_failed`, skip; alerts only.
- Metadata-missing → write placeholder skill row with
  `name='<unknown>'`, retry for up to 5 minutes.

**SQLite/chain drift** is resolved by:
- `POST /api/reset` — wipes SQLite, indexer re-projects from the
  oldest signature `getSignaturesForAddress(PROGRAM_ID)` can return.
  This API paginates backwards from the newest signature, capped at
  ~1000 entries per call, so for the hackathon's demo volume
  (≤200 txs total) a full re-projection is a few pages. In Slice 5
  we add a proper checkpoint that survives beyond the RPC's
  retention window.
- `GET /api/indexer/status?verify=1` — spot-check that on-chain
  `ShareLedger.total_shares` matches SQLite for 5 random skills.
- Indexer boot self-check — if `last_seen_sig` doesn't exist on
  chain (post-redeploy with new program id), auto-reset.

**Persona vault failures** — out-of-SOL personas get a UI banner on
`/console` pointing to `pnpm demo:personas:refund`; missing vault file
shows a setup banner.

**Judge daemon failures** — pending experiences stay Pending in
SQLite and on chain indefinitely; `/console` and `/me?expId=…`
polling re-triggers evaluation every 3s.

## Testing

**Layer 1 — Vitest unit tests** (run in `pnpm test`, always):

- `tests/chain/pdas.test.ts` — 9 PDA derivation assertions. Inputs
  are hard-coded pubkeys taken from `programs/slp/tests/common/fixtures.rs`
  (the Slice 2 Personas values); expected outputs are computed via
  `PublicKey.findProgramAddressSync` at test time. The assertions
  verify seed prefixes + ordering match the Rust `SEED_PREFIX`
  constants.
- `tests/chain/events.test.ts` — 8 event encode-then-decode
  round-trips: `BorshEventCoder.encode({name, data})` →
  `BorshEventCoder.decode(...)` → assert equality. Catches IDL drift
  after any future program change.
- `tests/chain/tx-builders.test.ts` — 8 instruction-build
  assertions verifying accounts list length + order + programId.
  Uses a stub `Signer` with a fixed pubkey.
- `tests/indexer/projection.test.ts` — 8 event-apply assertions
  against in-memory SQLite (`better-sqlite3` with `:memory:`), plus
  idempotency re-apply test (same event twice → identical DB state).
- `tests/indexer/metadata.test.ts` — metadata-fetch success and
  placeholder-on-missing cases, using the existing `ArweaveMock`.

**Layer 2 — Playwright devnet E2E** (`SLP_DEVNET_E2E=1`, gated):

- `tests/e2e/console-devnet.spec.ts` — one spec walking `/console`
  through all six PRD acts against a fresh deploy. Uses an ephemeral
  persona vault at `tests/e2e/.personas.json`. Runtime ~90s.
  Asserts: Explorer links appear, share-bar percentages match
  on-chain state, judge daemon evaluates within 10s,
  `/api/indexer/status?verify=1` returns ok, on-chain SOL balances
  move on claim.

**Layer 3 — Manual walkthrough** (pre-merge):
- Phantom + devnet: `/market → /skill/[id] → /publish → /submit →
  /me`.
- `/console` presenter mode end-to-end.
- Screenshots at 1440×900 of all six beats.

**CI wiring:**
- `pnpm test` (Vitest) on every PR.
- `pnpm test:e2e:devnet` only on PRs labeled `e2e` or merges to
  main. Uses a repo-secret deployer key.

## Acceptance criteria

Slice 3 is done when:

1. `slp` deployed to devnet at the declared program id.
   `ProtocolConfig` initialized with deployer as admin.
2. `data/demo-personas.json` exists with alice/bob/carol/judge each
   holding ≥1 SOL on devnet.
3. `pnpm tsx scripts/seed-devnet.ts` produces 6 on-chain skills
   visible in Explorer.
4. `/market` renders 6 skills; `/api/indexer/status?verify=1`
   returns `{ok: true}`.
5. `/skill/[id]` for each skill shows cap table + revenue panel +
   timeline + version list, all from indexer projections.
6. All six `/console` acts complete end-to-end against devnet with
   visible Explorer links. Judge daemon auto-evaluates within 10s.
7. `pnpm test:e2e:devnet` passes against a fresh deploy.
8. `pnpm test` passes (Vitest, offline).
9. `pnpm build` succeeds.
10. `cargo test` in `programs/` still passes (48/48 Slice 2 tests).
11. Every Slice 1 page renders identically except for added Explorer
    links on mutation success.
12. README has a "Run locally against devnet" section.

## Rollback

If the slice goes sideways, revert `main` to the Slice 2 merge commit
(`e5c08b4`). Slice 2 is independent of Slice 3. Worktree isolation
during implementation keeps `main` clean until the slice lands.

## Non-goals (explicitly deferred)

- Real Arweave / Irys / Lit Protocol / Anthropic-API Judge → Slice 4.
- Indexer WebSocket subscriptions (`onLogs`) → Slice 4+.
- Upgrade-authority revocation / multi-sig → Slice 5.
- Mobile layouts.
- Non-Phantom wallets.
- On-chain metadata fields.
- Slice 1 → Slice 3 SQLite data migration — first deploy wipes.

## Next slices after this ships

- **Slice 4:** real Arweave + Lit + Anthropic Judge. The interfaces
  `ArweaveStore`, `ContentGate`, and the Judge daemon's
  `scoreBundle()` swap are already factored for this — one
  import-line change each.
- **Slice 5:** production hardening — multi-RPC fallback, upgrade
  authority migration, indexer WebSocket, off-chain storage reset
  via PDA enumeration instead of sig-0 replay.
