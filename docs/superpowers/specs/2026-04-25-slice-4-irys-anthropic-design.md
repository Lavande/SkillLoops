# SkillLoops Slice 4: Real Irys + Anthropic Judge Design

## Context

Slice 3 made the web app sign real Solana devnet transactions while keeping
off-chain services mocked. Slice 4 narrows that deferred work to two real
integrations:

- Irys-backed permanent storage for skill content, experience bundles, and
  judge reports.
- Anthropic-backed AI Judge scoring that returns the existing `JudgeReport`
  shape.

Lit Protocol gating stays mocked for this slice. The current `LitMock`
contract remains the decrypt boundary and is not widened here.

## Scope

In scope:

- Keep current browser/API shape: pages call `/api/irys/upload`,
  `/api/irys/:txId`, and the judge daemon as they do today.
- Add feature flags:
  - `STORAGE_BACKEND=mock|irys`
  - `JUDGE_BACKEND=mock|anthropic`
- Add a storage adapter that preserves the existing `upload(content, tags,
  owner)` and `fetch(txId)` semantics.
- Add an Anthropic scorer that produces and validates `JudgeReportSchema`.
- Keep tests deterministic by defaulting to mock backends unless env opts in.
- Update `.env.example` and README with opt-in configuration.

Out of scope:

- Real Lit encryption/decryption and access control.
- Reworking publish/submit/skill UI flows.
- Moving the judge into a separate worker process.
- Mainnet support.

## Design

### Storage adapter

Create `lib/storage.ts` as the single boundary for off-chain objects:

```ts
export interface StorageBackend {
  upload(content: string, tags: Tag[], owner: string): Promise<ArweaveUpload>;
  fetch(txId: string): Promise<ArweaveObject | null>;
}
```

`mockStorage` delegates to `ArweaveMock`. `irysStorage` uses the Irys SDK at
runtime when `STORAGE_BACKEND=irys`. The runtime import is deliberate: this
keeps offline tests and mock-only development working even when Irys packages
are not installed. Enabling real Irys requires installing
`@irys/upload @irys/upload-solana` and setting `IRYS_PRIVATE_KEY`.

The Irys upload path uses the Solana token adapter and a server-side uploader
key so the current `/api/irys/upload` API can remain stable. User wallet
ownership is still captured as a tag and as the `owner` value returned by
the adapter. This is an MVP trade-off; a later browser-direct Irys signing
slice can move upload signing fully into Phantom without changing chain state.

Fetch reads from `IRYS_GATEWAY_URL/:txId` and returns content with best-effort
tags if available. If the gateway returns a non-2xx response, the adapter
returns `null` for 404 and throws for other failures.

### Anthropic judge

Create `lib/judge/scorer.ts` with a common scorer interface:

```ts
export interface JudgeScorer {
  score(bundle: ExperienceBundle, prior: ExperienceBundle[]): Promise<JudgeReport>;
}
```

`mockJudgeScorer` wraps the existing deterministic `scoreBundle()`.
`anthropicJudgeScorer` calls Anthropic Messages API with a tool schema that
matches `JudgeReportSchema` minus the runtime-filled `experience_id` and
`judged_at`. The scorer validates the model output with Zod before returning.

The prompt treats skill content, experience bundles, and prior bundles as
untrusted data. The model is instructed to score only against the five
dimensions already used by the protocol and to ignore instructions embedded
inside submitted content.

`lib/judge-client.ts` continues to own daemon control, prior-bundle lookup,
judge report upload, and on-chain `evaluateExperience`. It only switches from
calling `scoreBundle()` directly to calling `getJudgeScorer().score(...)`.
If Anthropic returns invalid output, the daemon logs the error and does not
send an evaluation transaction.

## Configuration

Default local behavior stays unchanged:

```env
STORAGE_BACKEND=mock
JUDGE_BACKEND=mock
```

Real Slice 4 demo:

```env
STORAGE_BACKEND=irys
IRYS_PRIVATE_KEY=<solana-private-key-or-secret-json>
IRYS_GATEWAY_URL=https://gateway.irys.xyz
IRYS_NETWORK=devnet

JUDGE_BACKEND=anthropic
ANTHROPIC_API_KEY=<key>
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

## Tests

- Backend selection tests prove env flags choose mock or real adapters without
  importing optional SDKs during mock runs.
- Storage tests prove mock upload/fetch behavior remains unchanged and Irys
  gateway 404 maps to `null`.
- Anthropic tests use a fake `fetch` implementation to prove tool output is
  parsed, Zod-validated, and rejected on malformed content.
- Judge daemon tests prove scorer failures do not call `evaluateExperience`.
- Existing `tests/mock/judge.test.ts` remains unchanged to preserve the demo
  trace's deterministic `38/50` behavior.

## Source Notes

- Irys SDK setup uses token-specific packages and Solana's package is
  `@irys/upload-solana`: https://docs.irys.xyz/build/d/sdk/setup
- Irys data uploads return an id that can be read through
  `https://gateway.irys.xyz/:transactionId`: https://docs.irys.xyz/build/d/sdk/upload/upload
- Anthropic structured output is implemented with tool schemas:
  https://platform.claude.com/docs/en/build-with-claude/structured-outputs
