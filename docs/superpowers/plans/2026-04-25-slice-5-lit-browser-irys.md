# Slice 5 Real Lit + Browser Irys Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in real Lit encryption/decryption and browser wallet-backed Irys uploads while keeping mock defaults and `/console` deterministic.

**Architecture:** Add two client-side adapter boundaries: `lib/browser-irys.ts` for upload selection and `lib/lit/*` for access-condition construction plus encryption/decryption. Existing pages call these adapters; default mode delegates to existing API/mock paths, real mode runtime-imports browser-only SDKs.

**Tech Stack:** Next.js 14, Solana Wallet Adapter, `@irys/web-upload`, `@irys/web-upload-solana`, Lit SDK runtime imports, Vitest, Zod.

---

## File Map

- Create `lib/browser-irys.ts`: browser upload mode selection and Irys runtime import boundary.
- Create `tests/browser-irys/browser-irys.test.ts`: mode/default/runtime-import tests.
- Create `lib/lit/access.ts`: deterministic Solana Lit access condition construction.
- Create `lib/lit/client.ts`: Lit mode selection, mock envelope compatibility, real encrypt/decrypt wrappers.
- Create `tests/lit/access.test.ts`: access condition shape tests.
- Create `tests/lit/client.test.ts`: mock/real payload tests with fake SDK imports.
- Create `tests/lit/page-wiring.test.ts`: page source-level wiring assertions.
- Modify `app/publish/page.tsx`: encrypt content and upload through browser adapter.
- Modify `app/submit/page.tsx`: upload bundles through browser adapter.
- Modify `app/skill/[id]/page.tsx`: decrypt fetched content through Lit adapter.
- Modify `.env.example`: add Slice 5 public mode flags.
- Modify `README.md`: document real Lit + browser Irys setup.
- Modify `package.json` / `pnpm-lock.yaml`: add browser Irys and Lit dependencies.

## Task 1: Browser Irys Adapter

**Files:**
- Create: `lib/browser-irys.ts`
- Create: `tests/browser-irys/browser-irys.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests that assert:

```ts
expect(getBrowserStorageMode({})).toBe("api");
expect(getBrowserStorageMode({ NEXT_PUBLIC_STORAGE_MODE: "browser-irys" })).toBe("browser-irys");
```

and that `uploadObject` in API mode calls an injected API uploader without importing Irys, while browser mode calls fake `WebUploader(WebSolana).withProvider(wallet).devnet().upload(...)`.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run tests/browser-irys/browser-irys.test.ts
```

Expected: fails because `lib/browser-irys.ts` does not exist.

- [ ] **Step 3: Implement adapter**

`lib/browser-irys.ts` exports:

```ts
export interface BrowserUploadInput {
  content: string;
  tags: { name: string; value: string }[];
  wallet: unknown;
  owner: string;
}

export interface BrowserUploadResult {
  txId: string;
  via: "api" | "browser-irys";
}

export function getBrowserStorageMode(env?: Record<string, string | undefined>): "api" | "browser-irys";
export async function uploadObject(input: BrowserUploadInput, deps?: BrowserUploadDeps): Promise<BrowserUploadResult>;
```

Use runtime import for `@irys/web-upload` and `@irys/web-upload-solana`, apply `withProvider(wallet)`, apply `.devnet()` for devnet, upload content with tags, and return `receipt.id`.

- [ ] **Step 4: Run GREEN**

Run:

```bash
pnpm vitest run tests/browser-irys/browser-irys.test.ts
```

Expected: pass.

## Task 2: Lit Access Conditions

**Files:**
- Create: `lib/lit/access.ts`
- Create: `tests/lit/access.test.ts`

- [ ] **Step 1: Write failing tests**

Assert the access conditions:

- include an author branch with `method: ""`, `params: [":userAddress"]`, and `returnValueTest.value === author`.
- include an `or` operator.
- include a subscription PDA branch using program id, `"sub"`, skill id, and `":userAddress"`.
- use a Solana chain string for devnet/localnet/mainnet mapping.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run tests/lit/access.test.ts
```

Expected: fails because `lib/lit/access.ts` does not exist.

- [ ] **Step 3: Implement access builder**

Implement:

```ts
export interface SkillAccessInput {
  programId: string;
  skillId: string;
  author: string;
  cluster: "devnet" | "mainnet-beta" | "localnet";
}

export function buildSkillAccessConditions(input: SkillAccessInput): unknown[];
```

Return `[authorCondition, { operator: "or" }, subscriptionPdaCondition]`.

- [ ] **Step 4: Run GREEN**

Run:

```bash
pnpm vitest run tests/lit/access.test.ts
```

Expected: pass.

## Task 3: Lit Client Adapter

**Files:**
- Create: `lib/lit/client.ts`
- Create: `tests/lit/client.test.ts`

- [ ] **Step 1: Write failing tests**

Assert:

- `getLitMode({}) === "mock"`.
- mock encrypt returns the existing `enc::<skillId>::...` envelope.
- real encrypt returns JSON with `kind: "slp-lit-v1"`, `ciphertext`, `dataToEncryptHash`, `solRpcConditions`, and `litNetwork`.
- malformed real payloads are rejected before any SDK decrypt call.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run tests/lit/client.test.ts
```

Expected: fails because `lib/lit/client.ts` does not exist.

- [ ] **Step 3: Implement client**

Implement mode selection, mock compatibility, and runtime-imported real wrappers. Use injected fake dependencies in tests so offline suite never contacts Lit.

- [ ] **Step 4: Run GREEN**

Run:

```bash
pnpm vitest run tests/lit/client.test.ts
```

Expected: pass.

## Task 4: Page Wiring Tests

**Files:**
- Create: `tests/lit/page-wiring.test.ts`

- [ ] **Step 1: Write source-level assertions**

Assert:

- `app/publish/page.tsx` imports `encryptSkillContent` and `uploadObject`, and no longer imports `signMessage` or calls `api.uploadIrys`.
- `app/submit/page.tsx` imports `uploadObject`, and no longer imports `signMessage` or calls `api.uploadIrys`.
- `app/skill/[id]/page.tsx` imports `decryptSkillContent`, and no longer calls `api.litDecrypt`.
- `app/console/page.tsx` does not import `lib/browser-irys` or `lib/lit/client`.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm vitest run tests/lit/page-wiring.test.ts
```

Expected: fails because pages still use old calls.

## Task 5: Wire Pages

**Files:**
- Modify: `app/publish/page.tsx`
- Modify: `app/submit/page.tsx`
- Modify: `app/skill/[id]/page.tsx`

- [ ] **Step 1: Update publish**

Replace message-signing upload with:

```ts
const encrypted = await encryptSkillContent({
  plaintext: form.content,
  skillId: "pending",
  author: wallet,
  wallet: w,
});
const upload = await uploadObject({
  owner: wallet,
  wallet: w,
  content: encrypted.content,
  tags: [
    { name: "Protocol", value: "SLP" },
    { name: "Type", value: "SkillContent" },
    { name: "Name", value: form.name },
    { name: "Encrypted", value: encrypted.encrypted ? "true" : "false" },
  ],
});
```

Keep `publishSkill(... content: form.content ...)` unchanged.

- [ ] **Step 2: Update submit**

Replace message-signing upload with `uploadObject({ owner: wallet, wallet: w, content: json, tags })`.

- [ ] **Step 3: Update skill preview**

Replace `api.litDecrypt` with:

```ts
const plaintext = await decryptSkillContent({
  content: arweave.content,
  skillId: params.id,
  wallet: w,
  caller: wallet,
});
setPreview(plaintext);
```

- [ ] **Step 4: Run page wiring GREEN**

Run:

```bash
pnpm vitest run tests/lit/page-wiring.test.ts
```

Expected: pass.

## Task 6: Env, Docs, Dependencies

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Add dependencies**

Run:

```bash
pnpm add @irys/web-upload @irys/web-upload-solana @lit-protocol/lit-node-client @lit-protocol/encryption @lit-protocol/constants
```

- [ ] **Step 2: Update env/docs**

Add:

```env
NEXT_PUBLIC_STORAGE_MODE=api
NEXT_PUBLIC_LIT_MODE=mock
NEXT_PUBLIC_LIT_NETWORK=datil-dev
```

Document browser real mode:

```env
NEXT_PUBLIC_STORAGE_MODE=browser-irys
NEXT_PUBLIC_LIT_MODE=real
NEXT_PUBLIC_LIT_NETWORK=datil-dev
```

## Task 7: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm vitest run tests/browser-irys/browser-irys.test.ts tests/lit/access.test.ts tests/lit/client.test.ts tests/lit/page-wiring.test.ts
```

- [ ] **Step 2: Run full offline suite**

Run:

```bash
pnpm test
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: pass. Do not run `pnpm build`; font/build hardening is out of scope for this slice.

## Self-Review

- Spec coverage: browser Irys, real Lit, page wiring, mock fallback, docs/env, and verification are covered.
- Placeholder scan: no task depends on unspecified behavior.
- Type consistency: `uploadObject`, `getBrowserStorageMode`, `buildSkillAccessConditions`, `encryptSkillContent`, and `decryptSkillContent` are named consistently across tests and page wiring.
