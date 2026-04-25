# Slice 4 Irys + Anthropic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add opt-in real Irys storage and Anthropic Judge scoring while keeping mock defaults and the current web/API flows intact.

**Architecture:** Introduce narrow adapter boundaries: `lib/storage.ts` for off-chain object storage and `lib/judge/scorer.ts` for judge scoring. Existing API routes and `lib/judge-client.ts` switch to those adapters; pages keep their current calls.

**Tech Stack:** Next.js route handlers, Vitest, Zod, Irys SDK via runtime import, Anthropic Messages API via `fetch`.

---

## File Map

- Create `lib/storage.ts`: storage backend selection, mock wrapper, Irys upload/fetch implementation.
- Modify `app/api/irys/upload/route.ts`: call `getStorageBackend().upload`.
- Modify `app/api/irys/[txId]/route.ts`: call `getStorageBackend().fetch`.
- Create `tests/storage/storage.test.ts`: storage selection, mock compatibility, gateway behavior.
- Create `lib/judge/scorer.ts`: scorer selection, mock scorer, Anthropic scorer, tool-output parsing.
- Modify `lib/judge-client.ts`: use async scorer and storage backend.
- Create `tests/judge/scorer.test.ts`: Anthropic parsing and validation.
- Create `tests/judge/client.test.ts`: scorer failure does not evaluate on chain.
- Modify `.env.example`: add backend and real-service env vars.
- Modify `README.md`: document opt-in Slice 4 real-service setup.

## Task 1: Storage Adapter

**Files:**
- Create: `lib/storage.ts`
- Test: `tests/storage/storage.test.ts`

- [ ] **Step 1: Write the failing storage tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/lib/db";
import { getStorageBackend, irysStorage, mockStorage } from "@/lib/storage";

beforeEach(() => {
  closeDb();
  getDb(":memory:");
});

describe("storage backends", () => {
  it("defaults to mock storage", () => {
    expect(getStorageBackend({}).name).toBe("mock");
  });

  it("selects Irys storage when STORAGE_BACKEND=irys", () => {
    expect(getStorageBackend({ STORAGE_BACKEND: "irys" }).name).toBe("irys");
  });

  it("mock storage preserves upload and fetch behavior", async () => {
    const up = await mockStorage.upload("hello", [{ name: "Type", value: "Test" }], "owner-1");
    const obj = await mockStorage.fetch(up.txId);

    expect(up.txId).toMatch(/^ar_/);
    expect(obj?.content).toBe("hello");
    expect(obj?.tags).toEqual([{ name: "Type", value: "Test" }]);
    expect(obj?.owner).toBe("owner-1");
  });

  it("Irys fetch returns null for gateway 404", async () => {
    const fetchImpl = vi.fn(async () => new Response("missing", { status: 404 }));
    const obj = await irysStorage.fetch("missing-id", {
      env: { IRYS_GATEWAY_URL: "https://gateway.example" },
      fetchImpl,
    });

    expect(obj).toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith("https://gateway.example/missing-id");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/storage/storage.test.ts`

Expected: FAIL because `@/lib/storage` does not exist.

- [ ] **Step 3: Implement `lib/storage.ts`**

Use these exported names and signatures:

```ts
import { ArweaveMock, type ArweaveObject, type ArweaveUpload, type Tag } from "@/lib/mock/arweave";

export interface StorageBackend {
  name: "mock" | "irys";
  upload(content: string, tags: Tag[], owner: string): Promise<ArweaveUpload>;
  fetch(txId: string): Promise<ArweaveObject | null>;
}

interface IrysDeps {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  importImpl?: (specifier: string) => Promise<any>;
}

const runtimeImport = (specifier: string) =>
  new Function("specifier", "return import(specifier)")(specifier) as Promise<any>;

export const mockStorage: StorageBackend = {
  name: "mock",
  async upload(content, tags, owner) {
    return ArweaveMock.upload(content, tags, owner);
  },
  async fetch(txId) {
    return ArweaveMock.fetch(txId);
  },
};

export const irysStorage = {
  name: "irys" as const,
  async upload(content: string, tags: Tag[], owner: string, deps: IrysDeps = {}): Promise<ArweaveUpload> {
    const env = deps.env ?? process.env;
    const privateKey = env.IRYS_PRIVATE_KEY;
    if (!privateKey) throw new Error("irys_private_key_required");

    const importImpl = deps.importImpl ?? runtimeImport;
    const [{ Uploader }, { Solana }] = await Promise.all([
      importImpl("@irys/upload"),
      importImpl("@irys/upload-solana"),
    ]);
    let uploader = await Uploader(Solana).withWallet(privateKey);
    if (env.IRYS_NETWORK === "devnet" && typeof uploader.devnet === "function") uploader = uploader.devnet();
    if (env.NEXT_PUBLIC_SOLANA_RPC && typeof uploader.withRpc === "function") {
      uploader = uploader.withRpc(env.NEXT_PUBLIC_SOLANA_RPC);
    }
    const receipt = await uploader.upload(content, {
      tags: [
        ...tags,
        { name: "Owner", value: owner },
        { name: "Content-Type", value: "application/json" },
      ],
    });
    const id = receipt?.id;
    if (!id || typeof id !== "string") throw new Error("irys_upload_missing_id");
    return { txId: id };
  },
  async fetch(txId: string, deps: IrysDeps = {}): Promise<ArweaveObject | null> {
    const env = deps.env ?? process.env;
    const fetchImpl = deps.fetchImpl ?? fetch;
    const gateway = (env.IRYS_GATEWAY_URL ?? "https://gateway.irys.xyz").replace(/\/+$/, "");
    const res = await fetchImpl(`${gateway}/${txId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`irys_fetch_failed_${res.status}`);
    return {
      content: await res.text(),
      tags: [],
      owner: "irys",
      uploadedAt: Math.floor(Date.now() / 1000),
    };
  },
} satisfies StorageBackend & {
  upload(content: string, tags: Tag[], owner: string, deps?: IrysDeps): Promise<ArweaveUpload>;
  fetch(txId: string, deps?: IrysDeps): Promise<ArweaveObject | null>;
};

export function getStorageBackend(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): StorageBackend {
  return env.STORAGE_BACKEND === "irys" ? irysStorage : mockStorage;
}
```

- [ ] **Step 4: Run the storage tests and verify GREEN**

Run: `pnpm vitest run tests/storage/storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/storage.ts tests/storage/storage.test.ts
git commit -m "feat(storage): add irys backend adapter"
```

## Task 2: Route Storage Through Adapter

**Files:**
- Modify: `app/api/irys/upload/route.ts`
- Modify: `app/api/irys/[txId]/route.ts`
- Test: `tests/storage/storage.test.ts`

- [ ] **Step 1: Add failing route-source assertions**

Append to `tests/storage/storage.test.ts`:

```ts
import fs from "node:fs";
import path from "node:path";

describe("Irys API routes", () => {
  it("upload route uses storage adapter instead of ArweaveMock directly", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/api/irys/upload/route.ts"), "utf8");
    expect(src).toContain("getStorageBackend");
    expect(src).not.toContain("ArweaveMock");
  });

  it("fetch route uses storage adapter instead of ArweaveMock directly", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/api/irys/[txId]/route.ts"), "utf8");
    expect(src).toContain("getStorageBackend");
    expect(src).not.toContain("ArweaveMock");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/storage/storage.test.ts`

Expected: FAIL because the routes still import `ArweaveMock`.

- [ ] **Step 3: Modify the routes**

In `app/api/irys/upload/route.ts`, replace the mock import and call:

```ts
import { getStorageBackend } from "@/lib/storage";
```

```ts
return getStorageBackend().upload(body.content, body.tags ?? [], owner);
```

In `app/api/irys/[txId]/route.ts`, replace the mock import and call:

```ts
import { getStorageBackend } from "@/lib/storage";
```

```ts
const obj = await getStorageBackend().fetch(params.txId);
```

- [ ] **Step 4: Run the route tests and verify GREEN**

Run: `pnpm vitest run tests/storage/storage.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add app/api/irys/upload/route.ts app/api/irys/[txId]/route.ts tests/storage/storage.test.ts
git commit -m "feat(api): route irys endpoints through storage adapter"
```

## Task 3: Anthropic Scorer

**Files:**
- Create: `lib/judge/scorer.ts`
- Test: `tests/judge/scorer.test.ts`

- [ ] **Step 1: Write failing scorer tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { anthropicJudgeScorer, getJudgeScorer, mockJudgeScorer } from "@/lib/judge/scorer";
import type { ExperienceBundle } from "@/lib/schemas";

function bundle(over: Partial<ExperienceBundle> = {}): ExperienceBundle {
  return {
    version: "1.0",
    skill_id: "skill_demo",
    skill_version: 1,
    trace_id: "generic-1",
    submitted_at: 1_700_000_000,
    context: { task_description: "task", input_summary: "input" },
    trajectory: [{ step: 1, action: "a", observation: "o", result: "missed" }],
    outcome: "partial",
    root_cause_analysis: "the skill misses a language specific safety branch",
    lesson_learned: "add explicit safety checks",
    proposed_patch: { type: "new_step", target_section: "step 2", diff: "+ check unsafe blocks" },
    test_case: { input_pr_diff: "diff", expected_review_must_contain: "unsafe" },
    generated_by_reflection_skill_version: "1.0.0",
    ...over,
  };
}

describe("judge scorer selection", () => {
  it("defaults to mock scorer", () => {
    expect(getJudgeScorer({}).name).toBe("mock");
  });

  it("selects Anthropic scorer with JUDGE_BACKEND=anthropic", () => {
    expect(getJudgeScorer({ JUDGE_BACKEND: "anthropic" }).name).toBe("anthropic");
  });

  it("mock scorer preserves deterministic behavior", async () => {
    const report = await mockJudgeScorer.score(bundle(), []);
    expect(report.recommendation).toBe("APPROVE");
    expect(report.weighted_total).toBeGreaterThanOrEqual(20);
  });
});

describe("anthropicJudgeScorer", () => {
  it("parses valid tool output and fills runtime fields", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        content: [{
          type: "tool_use",
          name: "record_judge_report",
          input: {
            judge_id: "anthropic:test-model",
            scores: { novelty: 8, specificity: 7, actionability: 9, reproducibility: 6, impact: 8 },
            weighted_total: 39,
            reasoning: { novelty: "fresh", specificity: "trace", actionability: "patch", reproducibility: "test", impact: "broad" },
            duplicate_check: { is_duplicate: false, similarity_to_existing: 0.1 },
            recommendation: "APPROVE",
          },
        }],
      })
    );

    const report = await anthropicJudgeScorer.score(bundle(), [], {
      env: { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "test-model" },
      fetchImpl,
      now: () => 1234,
    });

    expect(report.experience_id).toBe(0);
    expect(report.judged_at).toBe(1234);
    expect(report.weighted_total).toBe(39);
    expect(fetchImpl).toHaveBeenCalledWith("https://api.anthropic.com/v1/messages", expect.any(Object));
  });

  it("rejects malformed tool output", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ content: [{ type: "tool_use", name: "record_judge_report", input: { weighted_total: 99 } }] })
    );

    await expect(
      anthropicJudgeScorer.score(bundle(), [], {
        env: { ANTHROPIC_API_KEY: "test-key", ANTHROPIC_MODEL: "test-model" },
        fetchImpl,
      })
    ).rejects.toThrow(/anthropic_judge_invalid_report/);
  });
});
```

- [ ] **Step 2: Run the scorer tests and verify RED**

Run: `pnpm vitest run tests/judge/scorer.test.ts`

Expected: FAIL because `@/lib/judge/scorer` does not exist.

- [ ] **Step 3: Implement `lib/judge/scorer.ts`**

Implement exports: `JudgeScorer`, `mockJudgeScorer`, `anthropicJudgeScorer`,
`getJudgeScorer`. Anthropic must use `fetch` directly, POST to
`https://api.anthropic.com/v1/messages`, send `anthropic-version:
2023-06-01`, and use a single tool named `record_judge_report`.

- [ ] **Step 4: Run the scorer tests and verify GREEN**

Run: `pnpm vitest run tests/judge/scorer.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/judge/scorer.ts tests/judge/scorer.test.ts
git commit -m "feat(judge): add anthropic scorer adapter"
```

## Task 4: Wire Judge Daemon to Adapters

**Files:**
- Modify: `lib/judge-client.ts`
- Test: `tests/judge/client.test.ts`

- [ ] **Step 1: Write a failing source-level daemon test**

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("judge client wiring", () => {
  it("uses scorer and storage adapters instead of direct mocks", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "lib/judge-client.ts"), "utf8");
    expect(src).toContain("getJudgeScorer");
    expect(src).toContain("getStorageBackend");
    expect(src).not.toContain("scoreBundle");
    expect(src).not.toContain("ArweaveMock");
  });
});
```

- [ ] **Step 2: Run the daemon test and verify RED**

Run: `pnpm vitest run tests/judge/client.test.ts`

Expected: FAIL because `judge-client` still imports mocks directly.

- [ ] **Step 3: Modify `lib/judge-client.ts`**

Replace:

```ts
import { ArweaveMock } from "./mock/arweave";
import { scoreBundle, JUDGE_ID } from "./mock/judge";
```

with:

```ts
import { getStorageBackend } from "./storage";
import { getJudgeScorer, JUDGE_ID } from "./judge/scorer";
```

Inside `evaluateOnce()`, initialize:

```ts
const storage = getStorageBackend();
const scorer = getJudgeScorer();
```

Replace bundle fetch and report upload with `await storage.fetch(...)` and
`await storage.upload(...)`. Replace `scoreBundle(bundle, priorBundles)` with
`await scorer.score(bundle, priorBundles)`.

- [ ] **Step 4: Run daemon test and relevant judge tests**

Run: `pnpm vitest run tests/judge/client.test.ts tests/judge/scorer.test.ts tests/mock/judge.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/judge-client.ts tests/judge/client.test.ts
git commit -m "feat(judge): wire daemon through scorer and storage adapters"
```

## Task 5: Env and Docs

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: Update `.env.example`**

Add:

```env
# --- Slice 4 real-service backends ---
STORAGE_BACKEND=mock
JUDGE_BACKEND=mock

# Required only when STORAGE_BACKEND=irys
IRYS_PRIVATE_KEY=
IRYS_GATEWAY_URL=https://gateway.irys.xyz
IRYS_NETWORK=devnet

# Required only when JUDGE_BACKEND=anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

- [ ] **Step 2: Update README**

Add a section named `Slice 4 real Irys + Judge opt-in` with:

```md
## Slice 4 real Irys + Judge opt-in

The default local demo still uses mock storage and the deterministic mock
judge. To use real Irys storage and Anthropic scoring:

```bash
pnpm add @irys/upload @irys/upload-solana
```

Then set:

```env
STORAGE_BACKEND=irys
IRYS_PRIVATE_KEY=<solana-private-key-or-secret-json>
IRYS_GATEWAY_URL=https://gateway.irys.xyz
IRYS_NETWORK=devnet

JUDGE_BACKEND=anthropic
ANTHROPIC_API_KEY=<key>
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

Lit decrypt remains mocked in this slice.
```

- [ ] **Step 3: Commit**

Run:

```bash
git add .env.example README.md
git commit -m "docs: document slice 4 real service flags"
```

## Task 6: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run targeted tests**

Run:

```bash
pnpm vitest run tests/storage/storage.test.ts tests/judge/scorer.test.ts tests/judge/client.test.ts tests/mock/judge.test.ts
```

Expected: all listed test files pass.

- [ ] **Step 2: Run full offline test suite**

Run: `pnpm test`

Expected: all Vitest tests pass.

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck`

Expected: TypeScript exits 0.

- [ ] **Step 4: Check worktree diff**

Run: `git status --short && git log --oneline -6`

Expected: no unstaged source changes except generated `tsconfig.tsbuildinfo` if TypeScript updates it; recent commits show the Slice 4 docs and feature commits.

## Self-Review

- Spec coverage: storage adapter, Irys route wiring, Anthropic scorer, daemon wiring, env/docs, and verification are covered.
- Placeholder scan: no task relies on deferred-work markers or incomplete wording.
- Type consistency: exported names are `getStorageBackend`, `mockStorage`, `irysStorage`, `getJudgeScorer`, `mockJudgeScorer`, and `anthropicJudgeScorer` throughout.
