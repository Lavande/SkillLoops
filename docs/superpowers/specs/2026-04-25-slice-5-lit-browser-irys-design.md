# SkillLoops Slice 5: Real Lit + Browser Irys Design

## Context

Slice 4 added opt-in real Irys storage and Anthropic judge scoring while keeping
mock defaults. The remaining PRD gap in the publish/subscribe/submit path is
that content gating still uses `LitMock`, and real Irys uploads are signed by a
server-side uploader key instead of the connected browser wallet.

This slice closes those two gaps without widening the release-hardening scope.
Build stability, local fonts, GitHub Actions, devnet deploy verification, and
upgrade-authority hardening are intentionally left for a later slice.

## Scope

In scope:

- Add browser-side Irys upload for publish and submit flows.
- Add real Lit encryption/decryption for skill content, gated by Solana account
  state.
- Preserve the current mock paths as the default development/demo behavior.
- Keep `/console` on mock Irys/Lit so the presenter script remains deterministic.
- Add feature flags:
  - `NEXT_PUBLIC_STORAGE_MODE=api|browser-irys`
  - `NEXT_PUBLIC_LIT_MODE=mock|real`
  - `NEXT_PUBLIC_LIT_NETWORK=datil-dev|datil-test|datil`
- Add tests for mode selection, Lit payload shape, Solana access condition
  construction, and page-source wiring.
- Document the real-mode setup in README.

Out of scope:

- Fixing `next/font/google` production build failures.
- Adding CI.
- Moving judge daemon out of the Next.js process.
- Changing the on-chain program.
- Mainnet support.
- Making `/console` use real Lit/Irys.
- Replacing the existing wallet adapter stack.

## Approach

Use an adapter-first design. Existing pages continue to call small helper
modules instead of importing Lit or Irys SDKs directly. The helpers choose mock
or real implementations based on public environment variables. This keeps the
offline test suite and demo path stable while allowing a real browser-wallet
path for the ordinary user flows.

The public modes are:

```env
NEXT_PUBLIC_STORAGE_MODE=api
NEXT_PUBLIC_LIT_MODE=mock
```

for the default local flow, and:

```env
NEXT_PUBLIC_STORAGE_MODE=browser-irys
NEXT_PUBLIC_LIT_MODE=real
NEXT_PUBLIC_LIT_NETWORK=datil-dev
```

for real Slice 5 testing.

## Browser Irys

Create `lib/browser-irys.ts` as the browser upload boundary. It exports:

```ts
export interface BrowserUploadInput {
  content: string;
  tags: { name: string; value: string }[];
  wallet: unknown;
}

export interface BrowserUploadResult {
  txId: string;
  via: "api" | "browser-irys";
}

export function getBrowserStorageMode(env?: Record<string, string | undefined>): "api" | "browser-irys";
export async function uploadObject(input: BrowserUploadInput): Promise<BrowserUploadResult>;
```

In `api` mode, `uploadObject` delegates to the existing `/api/irys/upload`
route through `lib/api-client.ts`. This preserves current mock and server-Irys
behavior.

In `browser-irys` mode, `uploadObject` runtime-imports
`@irys/web-upload` and `@irys/web-upload-solana`, creates
`WebUploader(WebSolana).withProvider(wallet)`, applies `.devnet()` when the
Solana cluster is devnet, and uploads the object with tags. It returns the
receipt id as `txId`.

The runtime import is deliberate. Offline tests and mock/default development
must not require browser-only Irys packages to be installed or loaded.

## Lit Gating

Create `lib/lit/access.ts` for deterministic construction of Solana access
conditions. It exports:

```ts
export interface SkillAccessInput {
  programId: string;
  skillId: string;
  author: string;
  cluster: "devnet" | "mainnet-beta" | "localnet";
}

export function buildSkillAccessConditions(input: SkillAccessInput): unknown[];
```

The access condition uses Lit Solana RPC Conditions. Lit's Solana docs specify
that Solana access checks use `solRpcConditions` instead of EVM access condition
arrays. They also support PDA derivation with `pdaParams`, `pdaInterface`, and
`pdaKey`. The condition for SkillLoops allows either:

- the skill author, authenticated through the connected Solana wallet, or
- a subscriber with a derived `Subscription` PDA for
  `["sub", skill, ":userAddress"]` under the deployed `slp` program.

The author branch prevents Alice from losing access to her own encrypted skill
because authors do not create `Subscription` accounts when they publish.

Because Lit condition support for decoding custom Anchor accounts is narrower
than our local TypeScript indexer, the MVP condition uses existence of the
subscription PDA as the hard gate. Expiry is still enforced by the on-chain
program for subscription renewal and by the existing read model in mock mode.
If Lit account-data decoding proves reliable during implementation, the plan
may tighten this to check the serialized `is_active` byte and `expiry_time`
against current time; otherwise we keep the existence gate and document it as
an MVP limitation.

Create `lib/lit/client.ts` as the browser Lit boundary. It exports:

```ts
export interface EncryptedSkillPayload {
  kind: "slp-lit-v1";
  ciphertext: string;
  dataToEncryptHash: string;
  solRpcConditions: unknown[];
  litNetwork: string;
}

export function getLitMode(env?: Record<string, string | undefined>): "mock" | "real";
export async function encryptSkillContent(args: {
  plaintext: string;
  skillId: string;
  author: string;
  wallet: unknown;
}): Promise<{ content: string; encrypted: boolean }>;
export async function decryptSkillContent(args: {
  content: string;
  skillId: string;
  wallet: unknown;
  caller: string;
}): Promise<string>;
```

In `mock` mode, these helpers preserve the current `LitMock` envelope behavior.

In `real` mode, `encryptSkillContent` runtime-imports the Lit SDK, connects to
`NEXT_PUBLIC_LIT_NETWORK`, builds the `solRpcConditions`, encrypts the skill
content, and returns a JSON string containing the encrypted payload. The
payload, not plaintext, is uploaded to Irys.

In `real` mode, `decryptSkillContent` parses the JSON payload, authenticates the
connected Solana wallet with Lit, and calls Lit decrypt using the stored
`solRpcConditions`, `ciphertext`, and `dataToEncryptHash`. The result is the
plaintext SKILL.md.

## Page Wiring

`/publish` changes:

- Replace the explicit message-signing upload pre-step with
  `encryptSkillContent` followed by `uploadObject`.
- Preserve the current Solana `publishSkill` transaction exactly.
- The chain still stores the Irys tx id and content hash. The content hash is
  computed over the original plaintext SKILL.md, matching the existing program
  semantics.

`/submit` changes:

- Replace `/api/irys/upload` direct use with `uploadObject`.
- Do not use Lit. Experience bundles remain clear JSON because the judge must
  fetch and score them.
- Preserve the current Solana `submitExperience` transaction exactly.

`/skill/[id]` changes:

- Fetch the Irys object as today.
- Pass object content through `decryptSkillContent`.
- In mock mode, behavior remains current.
- In real mode, unauthorized users fail at Lit decrypt and see the existing
  access error surface.

`/console` changes:

- None for this slice. Console remains deterministic and uses the current API
  upload route, which defaults to mock storage.

## Security Notes

- Skill content is no longer uploaded as plaintext in real mode.
- Browser Irys mode removes the server uploader key from the ordinary user
  upload path.
- The access condition uses on-chain Solana state and the user's Lit-authenticated
  Solana address.
- The MVP Lit gate may check subscription PDA existence rather than expiry if
  custom Anchor account decoding is unreliable in Lit conditions. This is
  acceptable for the hackathon demo but must be called out before production.
- Experience bundles and judge reports remain unencrypted by design so the
  judge and public audit trail can read them.

## Configuration

Default:

```env
NEXT_PUBLIC_STORAGE_MODE=api
NEXT_PUBLIC_LIT_MODE=mock
NEXT_PUBLIC_LIT_NETWORK=datil-dev
```

Real Slice 5 browser flow:

```env
NEXT_PUBLIC_STORAGE_MODE=browser-irys
NEXT_PUBLIC_LIT_MODE=real
NEXT_PUBLIC_LIT_NETWORK=datil-dev
```

Required packages for real mode:

```bash
pnpm add @irys/web-upload @irys/web-upload-solana @lit-protocol/lit-node-client @lit-protocol/encryption @lit-protocol/constants
```

## Tests

- `tests/browser-irys/browser-irys.test.ts`
  - Defaults to `api` mode.
  - Selects `browser-irys` with env flag.
  - Does not import Irys packages in `api` mode.
  - Calls WebUploader/WebSolana with provider and tags in `browser-irys` mode
    using fake imports.

- `tests/lit/access.test.ts`
  - Builds deterministic subscription-PDA access conditions for a skill/user.
  - Uses `solRpcConditions` shape, not EVM access conditions.
  - Includes the deployed program id, skill id, author address, and
    `:userAddress` substitution token.

- `tests/lit/client.test.ts`
  - Defaults to mock mode.
  - Real encrypt returns an `slp-lit-v1` JSON payload with ciphertext,
    hash, conditions, and network.
  - Real decrypt rejects malformed payloads before calling Lit.

- `tests/lit/page-wiring.test.ts`
  - `/publish` imports and calls `encryptSkillContent` and `uploadObject`.
  - `/submit` imports and calls `uploadObject`.
  - `/skill/[id]` imports and calls `decryptSkillContent`.
  - `/console` does not import browser Lit/Irys helpers.

## Acceptance Criteria

- Default local demo behavior remains unchanged with no new env vars.
- In real mode, publish uploads encrypted skill content through the browser
  wallet-backed Irys uploader.
- In real mode, submit uploads the ExperienceBundle through the browser
  wallet-backed Irys uploader.
- In real mode, author/subscriber can decrypt skill content with Lit.
- In real mode, non-subscriber cannot decrypt skill content.
- `/console` still runs through the deterministic mock path.
- `pnpm test` and `pnpm typecheck` pass.

## Source Notes

- Lit Solana access control conditions use `solRpcConditions` and support PDA
  derivation through `pdaParams`, `pdaInterface`, and `pdaKey`:
  https://developer.litprotocol.com/sdk/access-control/solana/sol-rpc-conditions
- Irys browser uploads use `@irys/web-upload` with token-specific packages such
  as `@irys/web-upload-solana`:
  https://docs.irys.xyz/build/d/irys-in-the-browser
- Irys documents Lit + Irys browser integration as a supported pattern:
  https://docs.irys.xyz/build/d/guides/encrypting-with-lit

## Self-Review

- Placeholder scan: no deferred placeholders or TODOs are used as requirements.
- Internal consistency: browser Irys, Lit gating, page wiring, and tests all use
  the same adapter-first mock-default design.
- Scope check: Slice 5 is limited to Lit + browser Irys; font/build hardening,
  CI, and upgrade authority are explicitly out of scope.
- Ambiguity check: the Lit access condition is intentionally specified as
  subscription-PDA existence first, with expiry-byte tightening only if Lit's
  Solana account decoding proves reliable during implementation.
