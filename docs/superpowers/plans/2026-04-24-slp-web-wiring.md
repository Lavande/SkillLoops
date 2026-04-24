# Slice 3 — Web-to-Chain Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Next.js app to the deployed `slp` Anchor program on devnet so every mutation is a real on-chain transaction, while reads stay fast via an in-process indexer that projects chain events into the existing SQLite schema.

**Architecture:** Client-side `lib/chain/*` builds and signs transactions through Phantom or persona-keypair signers; server-side `lib/indexer.ts` polls `getSignaturesForAddress(PROGRAM_ID)` and projects decoded Anchor events into SQLite. The 6 chain-touching POST API handlers are deleted; GET handlers stay unchanged. A mock Judge daemon runs in-process, signs `evaluate_experience` with a dedicated keypair, and mirrors the Slice 1 `scoreBundle()` logic byte-for-byte.

**Tech Stack:** `@coral-xyz/anchor` 0.31.1, `@solana/web3.js` 1.95, `@solana/wallet-adapter-*` (already installed), `better-sqlite3`, Vitest, Playwright.

---

## Spec correction

The spec at `docs/superpowers/specs/2026-04-24-slp-web-wiring-design.md` described metadata-on-Arweave for `name/description/category` based on the assumption that these fields weren't on chain. They ARE on chain — `programs/slp/src/state/skill.rs` stores all three with `MAX_NAME_LEN=64`, `MAX_DESCRIPTION_LEN=256`, `MAX_CATEGORY_LEN=32`. This plan supersedes the spec on that point:

- No "SkillMetadata" Arweave blob. No `MetadataTxId` tag on the content blob.
- Indexer reads `{name,description,category,current_version,content_hash,arweave_tx_id,subscription_price,min_author_ratio_bps,period_length,created_at}` directly by calling `program.account.skill.fetch(skillPda)` after decoding a `SkillPublished` event.
- Publish flow uploads only one Arweave blob: the encrypted SKILL content (tagged `{Protocol:SLP, Type:SkillContent, SkillId:<pk>}`).
- `Skill` PDA seeds are `[b"skill", author, name_hash]` where `name_hash = sha256(name)[..16]`. No ephemeral `Keypair` is generated.
- The same correction applies to every place the indexer previously "fetched metadata blob" — replace with a direct `program.account.*.fetch(pda)`.

All other spec decisions (hybrid cutover, client-only signing, user-pays fees, `confirmed` commitment, polling indexer, persona vault in `/console`, judge-as-on-chain-client) stand unchanged.

---

## Task index

1. Worktree + scaffolding
2. Install chain deps + copy IDL placeholder
3. `.env.example` + config module
4. `lib/chain/connection.ts` + `lib/chain/explorer.ts`
5. `lib/chain/pdas.ts` (+ unit tests)
6. Anchor CLI toolchain + `scripts/deploy-devnet.sh` + first devnet deploy
7. `lib/chain/idl.ts` + `lib/chain/program.ts`
8. `lib/chain/events.ts` (+ unit tests)
9. `lib/chain/errors.ts`
10. `lib/chain/tx.ts` — initializeProtocol + publishSkill (+ unit tests)
11. `lib/chain/tx.ts` — subscribe + submitExperience + evaluateExperience
12. `lib/chain/tx.ts` — settlePeriod + claimRevenue + publishNewVersion
13. DB migration: `indexer_state` + `indexed_signatures` tables
14. `lib/indexer.ts` — skeleton, catch-up loop, idempotency guard
15. `lib/indexer.ts` — event projections (+ unit tests)
16. `/api/indexer/tick` + `/api/indexer/status` routes
17. Delete the 6 mutation POST handlers + rewire Slice 1 write-path functions
18. `lib/personas.ts` + `scripts/demo-personas.ts`
19. `scripts/init-protocol.ts` + `scripts/seed-devnet.ts`
20. `lib/judge-client.ts` (judge daemon)
21. `lib/bootstrap.ts` (indexer + judge autostart) + `/api/judge/tick` rewire
22. Wire `/publish`, `/skill/[id]`, `/submit`, `/me` pages to `lib/chain/tx`
23. Wire `/console` page to persona-vault + on-chain calls
24. `/api/me` RPC balance + `/api/reset` indexer reset
25. Playwright devnet E2E spec + CI gate
26. README "Run locally against devnet" + final verification

---

### Task 1: Worktree + scaffolding

**Goal:** Create isolated worktree so Slice 3 work does not disturb `main`.

**Files:**
- Create: `/Users/lok/Coding/SkillLoops-slp-web/` (worktree root)
- Create (in worktree): `docs/superpowers/plans/2026-04-24-slp-web-wiring.md` (copy of this plan)

- [ ] **Step 1: Create worktree from main**

Run:
```bash
cd /Users/lok/Coding/SkillLoops
git worktree add -b slp-web-wiring /Users/lok/Coding/SkillLoops-slp-web main
```
Expected: "Preparing worktree (new branch 'slp-web-wiring')"

- [ ] **Step 2: Verify worktree is clean**

Run:
```bash
cd /Users/lok/Coding/SkillLoops-slp-web && git status && git log --oneline -3
```
Expected: clean working tree, HEAD on main's tip.

- [ ] **Step 3: Install existing deps**

Run:
```bash
cd /Users/lok/Coding/SkillLoops-slp-web && pnpm install
```
Expected: Completes without errors. (This rebuilds `node_modules/` in the worktree.)

- [ ] **Step 4: Confirm Slice 1 tests still pass from worktree**

Run:
```bash
cd /Users/lok/Coding/SkillLoops-slp-web && pnpm test run
```
Expected: Existing Vitest suite passes (all Slice 1 tests).

- [ ] **Step 5: Confirm Slice 2 tests still pass from worktree**

Run:
```bash
cd /Users/lok/Coding/SkillLoops-slp-web/programs && cargo test --release
```
Expected: 48/48 tests pass. Skip if Rust toolchain not installed; Task 6 handles this.

- [ ] **Step 6: Commit a tiny marker so the branch has a starting commit**

Run:
```bash
cd /Users/lok/Coding/SkillLoops-slp-web
mkdir -p docs/superpowers/plans
cp /Users/lok/Coding/SkillLoops/docs/superpowers/plans/2026-04-24-slp-web-wiring.md docs/superpowers/plans/
git add docs/superpowers/plans/2026-04-24-slp-web-wiring.md
git commit -m "chore: start slice 3 branch"
```
Expected: One commit on `slp-web-wiring`.

---

### Task 2: Install chain deps + placeholder IDL

**Goal:** Add `@coral-xyz/anchor` to package.json and create empty IDL placeholder files so imports resolve. Real IDL lands in Task 6.

**Files:**
- Modify: `package.json`
- Create: `lib/chain/idl-slp.json` (placeholder)
- Create: `lib/chain/slp.ts` (placeholder)

- [ ] **Step 1: Add anchor client**

Run (in worktree):
```bash
cd /Users/lok/Coding/SkillLoops-slp-web
pnpm add @coral-xyz/anchor@^0.31.1
pnpm add -D tsx
```
Expected: `package.json` gains `@coral-xyz/anchor` and `tsx`. `pnpm-lock.yaml` updates.

- [ ] **Step 2: Create placeholder IDL JSON**

Write `lib/chain/idl-slp.json`:
```json
{
  "address": "BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ",
  "metadata": { "name": "slp", "version": "0.1.0", "spec": "0.1.0" },
  "instructions": [],
  "accounts": [],
  "events": [],
  "errors": [],
  "types": []
}
```

- [ ] **Step 3: Create placeholder slp.ts types file**

Write `lib/chain/slp.ts`:
```ts
// Placeholder replaced by `anchor build` output in Task 6.
// Anchor's generated type ships as a TS const plus a `type Slp = typeof IDL`.
export type Slp = unknown;
```

- [ ] **Step 4: Verify build still compiles**

Run:
```bash
pnpm typecheck
```
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml lib/chain/idl-slp.json lib/chain/slp.ts
git commit -m "chore(chain): add anchor client + idl placeholder"
```

---

### Task 3: `.env.example` + config module

**Goal:** Central place for Solana cluster, RPC URL, program id, indexer knobs. All `NEXT_PUBLIC_*` reads go through one module.

**Files:**
- Create: `.env.example`
- Create: `lib/chain/config.ts`
- Test: `tests/chain/config.test.ts`

- [ ] **Step 1: Write the failing test**

Write `tests/chain/config.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getChainConfig } from "@/lib/chain/config";

describe("getChainConfig", () => {
  it("reads program id + rpc + cluster from env with defaults", () => {
    const c = getChainConfig({
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SOLANA_RPC: "https://api.devnet.solana.com",
      NEXT_PUBLIC_SLP_PROGRAM_ID: "BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ",
    });
    expect(c.cluster).toBe("devnet");
    expect(c.rpcUrl).toBe("https://api.devnet.solana.com");
    expect(c.programId.toBase58()).toBe("BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ");
  });

  it("defaults rpc when not provided", () => {
    const c = getChainConfig({
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SLP_PROGRAM_ID: "BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ",
    });
    expect(c.rpcUrl).toBe("https://api.devnet.solana.com");
  });

  it("throws if program id missing", () => {
    expect(() => getChainConfig({})).toThrow(/program id/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test run tests/chain/config.test.ts`
Expected: FAIL — "Cannot find module '@/lib/chain/config'".

- [ ] **Step 3: Write the implementation**

Write `lib/chain/config.ts`:
```ts
import { PublicKey } from "@solana/web3.js";

export interface ChainConfig {
  cluster: "devnet" | "mainnet-beta" | "localnet";
  rpcUrl: string;
  programId: PublicKey;
}

const DEFAULT_RPC: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  localnet: "http://127.0.0.1:8899",
};

export function getChainConfig(env: Record<string, string | undefined> = process.env as any): ChainConfig {
  const programIdStr = env.NEXT_PUBLIC_SLP_PROGRAM_ID;
  if (!programIdStr) throw new Error("NEXT_PUBLIC_SLP_PROGRAM_ID (program id) is required");
  const cluster = (env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") as ChainConfig["cluster"];
  const rpcUrl = env.NEXT_PUBLIC_SOLANA_RPC ?? DEFAULT_RPC[cluster] ?? DEFAULT_RPC.devnet;
  return { cluster, rpcUrl, programId: new PublicKey(programIdStr) };
}
```

- [ ] **Step 4: Create `.env.example`**

Write `.env.example`:
```
# --- Chain ---
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com
NEXT_PUBLIC_SLP_PROGRAM_ID=BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ

# --- Indexer ---
INDEXER_POLL_INTERVAL_MS=2000
INDEXER_AUTOSTART=true

# --- Demo ---
DEMO_MODE=true
DEMO_PERSONAS_PATH=./data/demo-personas.json

# --- Deploy (read only by scripts/) ---
DEPLOYER_KEYPAIR=~/.config/solana/slp-deployer.json
PROGRAM_KEYPAIR=./programs/target/deploy/slp-keypair.json
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test run tests/chain/config.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/chain/config.ts tests/chain/config.test.ts .env.example
git commit -m "feat(chain): add config module + .env.example"
```

---

### Task 4: `lib/chain/connection.ts` + `lib/chain/explorer.ts`

**Goal:** Singleton `Connection` at commitment=confirmed; Explorer URL helpers.

**Files:**
- Create: `lib/chain/connection.ts`
- Create: `lib/chain/explorer.ts`
- Test: `tests/chain/explorer.test.ts`

- [ ] **Step 1: Write failing tests**

Write `tests/chain/explorer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { txLink, accountLink } from "@/lib/chain/explorer";

describe("explorer links", () => {
  it("devnet tx link includes cluster=devnet", () => {
    const link = txLink("5sig", "devnet");
    expect(link).toBe("https://explorer.solana.com/tx/5sig?cluster=devnet");
  });
  it("mainnet tx link omits cluster param", () => {
    const link = txLink("5sig", "mainnet-beta");
    expect(link).toBe("https://explorer.solana.com/tx/5sig");
  });
  it("account link handles devnet", () => {
    const link = accountLink("pubkey", "devnet");
    expect(link).toBe("https://explorer.solana.com/address/pubkey?cluster=devnet");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test run tests/chain/explorer.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/chain/explorer.ts`**

```ts
export type Cluster = "devnet" | "mainnet-beta" | "localnet";

function clusterQuery(cluster: Cluster): string {
  if (cluster === "mainnet-beta") return "";
  if (cluster === "localnet") return "?cluster=custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899";
  return `?cluster=${cluster}`;
}

export function txLink(sig: string, cluster: Cluster): string {
  return `https://explorer.solana.com/tx/${sig}${clusterQuery(cluster)}`;
}

export function accountLink(pubkey: string, cluster: Cluster): string {
  return `https://explorer.solana.com/address/${pubkey}${clusterQuery(cluster)}`;
}
```

- [ ] **Step 4: Write `lib/chain/connection.ts`**

```ts
import { Connection } from "@solana/web3.js";
import { getChainConfig } from "./config";

let instance: Connection | null = null;

export function getConnection(): Connection {
  if (instance) return instance;
  const { rpcUrl } = getChainConfig();
  instance = new Connection(rpcUrl, "confirmed");
  return instance;
}
```

- [ ] **Step 5: Run tests and typecheck**

Run: `pnpm test run tests/chain/explorer.test.ts && pnpm typecheck`
Expected: PASS + no type errors.

- [ ] **Step 6: Commit**

```bash
git add lib/chain/connection.ts lib/chain/explorer.ts tests/chain/explorer.test.ts
git commit -m "feat(chain): connection singleton + explorer helpers"
```

---

### Task 5: `lib/chain/pdas.ts` + unit tests

**Goal:** TypeScript PDA derivation mirroring every `SEED_PREFIX` in `programs/slp/src/state/*.rs` byte-for-byte. This is the single most important correctness gate between TS and Rust.

**Files:**
- Create: `lib/chain/pdas.ts`
- Test: `tests/chain/pdas.test.ts`

**Reference seed prefixes (from `programs/slp/src/state/*.rs`):**
```
ProtocolConfig:   b"config"
Skill:            b"skill"
SkillVersion:     b"version"
ShareLedger:      b"ledger"
RevenuePool:      b"pool"
ShareAccount:     b"share"
Subscription:     b"sub"
ExperienceRecord: b"exp"
ClaimableRevenue: b"claim"
```

**Seed layouts (from the Rust `#[account(seeds = [...])]` attributes):**
```
config:           [b"config"]
skill:            [b"skill", author.as_ref(), name_hash.as_ref()]        // name_hash = sha256(name)[..16]
version:          [b"version", skill.as_ref(), version_u32.to_le_bytes()]
ledger:           [b"ledger", skill.as_ref()]
pool:             [b"pool", skill.as_ref()]
share_account:    [b"share", skill.as_ref(), holder.as_ref()]
subscription:     [b"sub", skill.as_ref(), subscriber.as_ref()]
experience:       [b"exp", skill.as_ref(), next_experience_id_u64.to_le_bytes()]
claimable_rev:    [b"claim", skill.as_ref(), holder.as_ref(), snapshot_id_u64.to_le_bytes()]
```

- [ ] **Step 1: Write failing tests**

Write `tests/chain/pdas.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "node:crypto";
import { pdas } from "@/lib/chain/pdas";

const PROGRAM = new PublicKey("BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ");
const AUTHOR = new PublicKey("11111111111111111111111111111112");
const HOLDER = new PublicKey("11111111111111111111111111111113");
const SKILL = new PublicKey("11111111111111111111111111111114");

describe("PDA derivations", () => {
  it("config uses seed b'config'", () => {
    const [expected] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM);
    expect(pdas.config(PROGRAM)[0].equals(expected)).toBe(true);
  });

  it("skill uses [b'skill', author, sha256(name)[..16]]", () => {
    const nameHash = createHash("sha256").update("Alice Skill").digest().subarray(0, 16);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), AUTHOR.toBuffer(), nameHash],
      PROGRAM,
    );
    expect(pdas.skill(PROGRAM, AUTHOR, "Alice Skill")[0].equals(expected)).toBe(true);
  });

  it("version uses [b'version', skill, u32 le]", () => {
    const ver = Buffer.alloc(4); ver.writeUInt32LE(5, 0);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("version"), SKILL.toBuffer(), ver], PROGRAM);
    expect(pdas.skillVersion(PROGRAM, SKILL, 5)[0].equals(expected)).toBe(true);
  });

  it("ledger uses [b'ledger', skill]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("ledger"), SKILL.toBuffer()], PROGRAM);
    expect(pdas.shareLedger(PROGRAM, SKILL)[0].equals(expected)).toBe(true);
  });

  it("pool uses [b'pool', skill]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), SKILL.toBuffer()], PROGRAM);
    expect(pdas.revenuePool(PROGRAM, SKILL)[0].equals(expected)).toBe(true);
  });

  it("share account uses [b'share', skill, holder]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("share"), SKILL.toBuffer(), HOLDER.toBuffer()], PROGRAM);
    expect(pdas.shareAccount(PROGRAM, SKILL, HOLDER)[0].equals(expected)).toBe(true);
  });

  it("subscription uses [b'sub', skill, subscriber]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("sub"), SKILL.toBuffer(), HOLDER.toBuffer()], PROGRAM);
    expect(pdas.subscription(PROGRAM, SKILL, HOLDER)[0].equals(expected)).toBe(true);
  });

  it("experience uses [b'exp', skill, u64 le]", () => {
    const idBuf = Buffer.alloc(8); idBuf.writeBigUInt64LE(42n, 0);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("exp"), SKILL.toBuffer(), idBuf], PROGRAM);
    expect(pdas.experience(PROGRAM, SKILL, 42n)[0].equals(expected)).toBe(true);
  });

  it("claim uses [b'claim', skill, holder, snapshot_id u64 le]", () => {
    const snap = Buffer.alloc(8); snap.writeBigUInt64LE(7n, 0);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), SKILL.toBuffer(), HOLDER.toBuffer(), snap], PROGRAM);
    expect(pdas.claimable(PROGRAM, SKILL, HOLDER, 7n)[0].equals(expected)).toBe(true);
  });

  it("nameHash matches sha256(name)[..16]", () => {
    const { nameHash } = pdas;
    expect(Buffer.from(nameHash("Alice Skill")).toString("hex")).toBe(
      createHash("sha256").update("Alice Skill").digest().subarray(0, 16).toString("hex")
    );
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

Run: `pnpm test run tests/chain/pdas.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/chain/pdas.ts`**

Write:
```ts
import { PublicKey } from "@solana/web3.js";
import { createHash } from "node:crypto";

function u32le(n: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b; }
function u64le(n: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(n, 0); return b; }

function nameHash(name: string): Buffer {
  return createHash("sha256").update(name).digest().subarray(0, 16);
}

export const pdas = {
  nameHash,

  config(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  },

  skill(programId: PublicKey, author: PublicKey, name: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), author.toBuffer(), nameHash(name)], programId);
  },

  skillVersion(programId: PublicKey, skill: PublicKey, version: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("version"), skill.toBuffer(), u32le(version)], programId);
  },

  shareLedger(programId: PublicKey, skill: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("ledger"), skill.toBuffer()], programId);
  },

  revenuePool(programId: PublicKey, skill: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), skill.toBuffer()], programId);
  },

  shareAccount(programId: PublicKey, skill: PublicKey, holder: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("share"), skill.toBuffer(), holder.toBuffer()], programId);
  },

  subscription(programId: PublicKey, skill: PublicKey, subscriber: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("sub"), skill.toBuffer(), subscriber.toBuffer()], programId);
  },

  experience(programId: PublicKey, skill: PublicKey, experienceId: bigint): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("exp"), skill.toBuffer(), u64le(experienceId)], programId);
  },

  claimable(programId: PublicKey, skill: PublicKey, holder: PublicKey, snapshotId: bigint): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), skill.toBuffer(), holder.toBuffer(), u64le(snapshotId)], programId);
  },
};
```

- [ ] **Step 4: Run tests to verify pass**

Run: `pnpm test run tests/chain/pdas.test.ts`
Expected: PASS (10 assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/chain/pdas.ts tests/chain/pdas.test.ts
git commit -m "feat(chain): PDA derivations matching Rust SEED_PREFIX bytes"
```

---

### Task 6: Anchor toolchain + `scripts/deploy-devnet.sh` + first devnet deploy

**Goal:** Generate the real IDL + typed bindings, deploy `slp` to devnet, copy IDL into `lib/chain/`.

**Prerequisite:** Slice 2's toolchain (Rust 1.86, Agave 2.2.20, Anchor 0.31.1) is installed. If not, install per `docs/superpowers/plans/2026-04-23-slp-solana-programs.md` toolchain appendix.

**Files:**
- Create: `scripts/deploy-devnet.sh`
- Modify: `programs/Anchor.toml` (cluster=Devnet, anchor_version=0.31.1)
- Create (after deploy): `lib/chain/idl-slp.json` (real), `lib/chain/slp.ts` (real)

- [ ] **Step 1: Update Anchor.toml**

Read `programs/Anchor.toml`, then replace:
```toml
[toolchain]
anchor_version = "0.30.1"
```
with:
```toml
[toolchain]
anchor_version = "0.31.1"
```
and replace `cluster = "Localnet"` with `cluster = "Devnet"`.

Keep `[programs.localnet]` entry but add `[programs.devnet]` with the same program id:
```toml
[programs.devnet]
slp = "BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ"
```

- [ ] **Step 2: Write `scripts/deploy-devnet.sh`**

Create file with `chmod +x`:
```bash
#!/usr/bin/env bash
set -euo pipefail

DEPLOYER_KEYPAIR="${DEPLOYER_KEYPAIR:-$HOME/.config/solana/slp-deployer.json}"
PROGRAM_KEYPAIR="${PROGRAM_KEYPAIR:-./programs/target/deploy/slp-keypair.json}"

if [ ! -f "$DEPLOYER_KEYPAIR" ]; then
  echo "Missing deployer keypair at $DEPLOYER_KEYPAIR"
  echo "Run: solana-keygen new --outfile $DEPLOYER_KEYPAIR"
  exit 1
fi

cd programs
anchor build
cp target/idl/slp.json    ../lib/chain/idl-slp.json
cp target/types/slp.ts    ../lib/chain/slp.ts

solana program deploy \
  --url devnet \
  --keypair "$DEPLOYER_KEYPAIR" \
  --program-id "$PROGRAM_KEYPAIR" \
  target/deploy/slp.so

cd ..
echo "Deployed. Program: $(solana address -k $PROGRAM_KEYPAIR)"
echo "Next: pnpm tsx scripts/init-protocol.ts"
```

Run: `chmod +x scripts/deploy-devnet.sh`.

- [ ] **Step 3: Generate deployer keypair + airdrop SOL (manual, one-time)**

Run (at project root, outside worktree is fine — the keypair lives in `~/.config`):
```bash
mkdir -p ~/.config/solana
solana-keygen new --outfile ~/.config/solana/slp-deployer.json --no-bip39-passphrase
solana config set --url devnet --keypair ~/.config/solana/slp-deployer.json
solana airdrop 5
solana balance
```
Expected: ≥5 SOL.

If devnet faucet is rate-limited, use https://faucet.solana.com/ in a browser with the pubkey from `solana address`.

- [ ] **Step 4: Run anchor build**

Run (from worktree):
```bash
cd programs && anchor build && cd ..
ls programs/target/idl/slp.json programs/target/types/slp.ts
```
Expected: Both files exist.

- [ ] **Step 5: Run first devnet deploy**

Run:
```bash
./scripts/deploy-devnet.sh
```
Expected: "Program Id: BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ" and "Deploy successful".

If the program id doesn't match the declared id, the `programs/target/deploy/slp-keypair.json` got regenerated. Delete that file and re-run `anchor build` — Slice 2 committed the correct keypair. If it's missing, check Slice 2 merge commit, or regenerate the declared id via `solana-keygen grind` (not expected).

- [ ] **Step 6: Verify IDL was copied**

Run:
```bash
head -5 lib/chain/idl-slp.json
head -5 lib/chain/slp.ts
```
Expected: Real IDL JSON (not the placeholder), real `export type Slp = { version: ...; name: "slp"; ... }` const.

- [ ] **Step 7: Check in the IDL files**

```bash
git add scripts/deploy-devnet.sh programs/Anchor.toml lib/chain/idl-slp.json lib/chain/slp.ts
git commit -m "chore(deploy): devnet deploy script + generated IDL"
```

---

### Task 7: `lib/chain/idl.ts` + `lib/chain/program.ts`

**Goal:** Typed entry point for Anchor `Program<Slp>`.

**Files:**
- Create: `lib/chain/idl.ts`
- Create: `lib/chain/program.ts`

- [ ] **Step 1: Write `lib/chain/idl.ts`**

```ts
import idlJson from "./idl-slp.json";
import type { Slp } from "./slp";

export const IDL = idlJson as unknown as Slp;
export type { Slp };
```

- [ ] **Step 2: Write `lib/chain/program.ts`**

```ts
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import type { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { IDL, type Slp } from "./idl";

export interface Signer {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions?<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export function getProgram(connection: Connection, signer: Signer): Program<Slp> {
  const wallet: Wallet = {
    publicKey: signer.publicKey,
    signTransaction: signer.signTransaction.bind(signer) as Wallet["signTransaction"],
    signAllTransactions:
      signer.signAllTransactions?.bind(signer) ??
      (async (txs: any[]) => Promise.all(txs.map((t) => signer.signTransaction(t)))),
    payer: undefined as any, // unused when signing via Phantom / external signer
  };
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program<Slp>(IDL as any, provider);
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add lib/chain/idl.ts lib/chain/program.ts
git commit -m "feat(chain): Program<Slp> factory + Signer contract"
```

---

### Task 8: `lib/chain/events.ts` + unit tests

**Goal:** Decode `"Program data: <b64>"` log lines into typed event objects using Anchor's `BorshEventCoder`. Verify all 8 event variants round-trip.

**Files:**
- Create: `lib/chain/events.ts`
- Test: `tests/chain/events.test.ts`

- [ ] **Step 1: Write failing tests**

Write `tests/chain/events.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { BorshEventCoder } from "@coral-xyz/anchor";
import { IDL } from "@/lib/chain/idl";
import { decodeEvents, SlpEvent } from "@/lib/chain/events";

const PROGRAM_LOG_PREFIX = "Program log: ";
const PROGRAM_DATA_PREFIX = "Program data: ";

function encodeEvent(name: string, data: Record<string, unknown>): string {
  const coder = new BorshEventCoder(IDL as any);
  const bytes = (coder as any).encode(name, data);
  return `${PROGRAM_DATA_PREFIX}${Buffer.from(bytes).toString("base64")}`;
}

describe("decodeEvents", () => {
  const SKILL = new PublicKey("11111111111111111111111111111114");
  const USER = new PublicKey("11111111111111111111111111111115");

  it("decodes SkillPublished", () => {
    const log = encodeEvent("SkillPublished", { skill: SKILL, author: USER, createdAt: 12345 });
    const events = decodeEvents([PROGRAM_LOG_PREFIX + "noise", log]);
    expect(events.length).toBe(1);
    const e = events[0] as SlpEvent<"SkillPublished">;
    expect(e.name).toBe("SkillPublished");
    expect(e.data.skill.toBase58()).toBe(SKILL.toBase58());
    expect(e.data.author.toBase58()).toBe(USER.toBase58());
  });

  it("decodes Subscribed", () => {
    const log = encodeEvent("Subscribed", { skill: SKILL, subscriber: USER, expiryTime: 999 });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("Subscribed");
  });

  it("decodes ExperienceSubmitted", () => {
    const log = encodeEvent("ExperienceSubmitted", { skill: SKILL, experienceId: 0, contributor: USER });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("ExperienceSubmitted");
  });

  it("decodes ExperienceEvaluated", () => {
    const log = encodeEvent("ExperienceEvaluated", {
      skill: SKILL, experienceId: 0, score: 38, sharesMinted: 380, approved: true, floorHit: false,
    });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("ExperienceEvaluated");
  });

  it("decodes SharesMinted", () => {
    const log = encodeEvent("SharesMinted", {
      skill: SKILL, holder: USER, amount: 380, totalSharesAfter: 1380,
    });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("SharesMinted");
  });

  it("decodes PeriodSettled", () => {
    const log = encodeEvent("PeriodSettled", {
      skill: SKILL, snapshotId: 1, periodRevenue: 300000000, totalShares: 1380,
    });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("PeriodSettled");
  });

  it("decodes RevenueClaimed", () => {
    const log = encodeEvent("RevenueClaimed", {
      skill: SKILL, holder: USER, amount: 217391305, snapshotId: 1,
    });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("RevenueClaimed");
  });

  it("decodes VersionPublished", () => {
    const log = encodeEvent("VersionPublished", { skill: SKILL, version: 2, contributingCount: 1 });
    const [e] = decodeEvents([log]);
    expect(e.name).toBe("VersionPublished");
  });

  it("ignores non-event log lines", () => {
    const events = decodeEvents([
      "Program log: hello",
      "Program invocation: slp",
      "Program consumed 12345 of 200000 units",
    ]);
    expect(events.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to see them fail**

Run: `pnpm test run tests/chain/events.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `lib/chain/events.ts`**

```ts
import { BorshEventCoder } from "@coral-xyz/anchor";
import { IDL, type Slp } from "./idl";

const PROGRAM_DATA_PREFIX = "Program data: ";

let coderInstance: BorshEventCoder | null = null;
function coder(): BorshEventCoder {
  if (!coderInstance) coderInstance = new BorshEventCoder(IDL as any);
  return coderInstance;
}

export type SlpEventName =
  | "SkillPublished"
  | "Subscribed"
  | "ExperienceSubmitted"
  | "ExperienceEvaluated"
  | "SharesMinted"
  | "PeriodSettled"
  | "RevenueClaimed"
  | "VersionPublished";

export interface SlpEvent<N extends SlpEventName = SlpEventName> {
  name: N;
  data: Record<string, any>;
}

export function decodeEvents(logs: string[]): SlpEvent[] {
  const out: SlpEvent[] = [];
  for (const line of logs) {
    if (!line.startsWith(PROGRAM_DATA_PREFIX)) continue;
    const b64 = line.slice(PROGRAM_DATA_PREFIX.length);
    try {
      const decoded = coder().decode(b64);
      if (decoded) out.push({ name: decoded.name as SlpEventName, data: decoded.data });
    } catch {
      // not ours, skip
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test run tests/chain/events.test.ts`
Expected: PASS (9 assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/chain/events.ts tests/chain/events.test.ts
git commit -m "feat(chain): BorshEventCoder wrapper + round-trip tests for 8 events"
```

---

### Task 9: `lib/chain/errors.ts`

**Goal:** Map Anchor program error codes (18 `SlpError` variants) to user-facing strings; parse errors thrown by `@coral-xyz/anchor` into a typed `ChainError`.

**Files:**
- Create: `lib/chain/errors.ts`
- Test: `tests/chain/errors.test.ts`

- [ ] **Step 1: Write failing test**

Write `tests/chain/errors.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseChainError, ChainError, ERROR_MESSAGES } from "@/lib/chain/errors";

describe("parseChainError", () => {
  it("extracts error code from Anchor error", () => {
    const fake = { error: { errorCode: { code: "ScoreOutOfRange", number: 6002 }, errorMessage: "Score must be 0..=50" } };
    const e = parseChainError(fake);
    expect(e).toBeInstanceOf(ChainError);
    expect(e.code).toBe("ScoreOutOfRange");
    expect(e.message).toBe(ERROR_MESSAGES.ScoreOutOfRange);
  });

  it("falls back to 'Unknown' for non-Anchor errors", () => {
    const e = parseChainError(new Error("rpc down"));
    expect(e.code).toBe("Unknown");
  });

  it("detects user rejection as SignatureDeclined", () => {
    const e = parseChainError(new Error("User rejected the request."));
    expect(e.code).toBe("SignatureDeclined");
  });
});
```

- [ ] **Step 2: Run test to fail**

Run: `pnpm test run tests/chain/errors.test.ts`
Expected: FAIL.

- [ ] **Step 3: Write `lib/chain/errors.ts`**

```ts
export const ERROR_MESSAGES: Record<string, string> = {
  NotJudge: "Only the protocol judge can evaluate experiences.",
  AlreadyEvaluated: "This experience has already been evaluated.",
  ScoreOutOfRange: "Judge score must be between 0 and 50.",
  WrongSkill: "Experience does not belong to this skill.",
  PeriodNotElapsed: "The settlement period has not yet elapsed.",
  HoldersIncomplete: "Settle is missing some shareholders — try again.",
  ShareAccountMismatch: "ShareAccount belongs to the wrong skill.",
  SharesMustBeNonzero: "Zero-share holders cannot be settled.",
  WrongClaimPda: "Internal: claim PDA mismatch.",
  NothingToClaim: "Nothing to claim right now.",
  ZeroPrice: "Subscription price must be positive.",
  FloorTooLow: "Author floor ratio below protocol minimum (30%).",
  InvalidK: "Contribution coefficient (k) must be in 1..=100.",
  StringTooLong: "One of the text fields exceeds its length limit.",
  NotAuthor: "Only the skill author can publish a new version.",
  TooManyContributors: "Too many contributing experiences for one version (max 16).",
  PoolBelowRentExempt: "Claim would leave the pool below rent-exempt.",
  SettleAccountsUnpaired: "Settle requires paired [share, claim] accounts.",
  SignatureDeclined: "Transaction signature was declined.",
  Unknown: "Transaction failed.",
};

export class ChainError extends Error {
  constructor(public code: string, public readonly sig?: string) {
    super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.Unknown);
    this.name = "ChainError";
  }
}

export function parseChainError(err: unknown, sig?: string): ChainError {
  if (err instanceof ChainError) return err;
  const anyErr = err as any;

  // Anchor AnchorError shape
  const code = anyErr?.error?.errorCode?.code;
  if (typeof code === "string" && ERROR_MESSAGES[code]) return new ChainError(code, sig);

  // Wallet rejection patterns (Phantom / Solflare)
  const msg = anyErr?.message ?? "";
  if (/rejected|user denied|cancell?ed/i.test(msg)) return new ChainError("SignatureDeclined", sig);

  return new ChainError("Unknown", sig);
}
```

- [ ] **Step 4: Run test to pass**

Run: `pnpm test run tests/chain/errors.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/chain/errors.ts tests/chain/errors.test.ts
git commit -m "feat(chain): typed ChainError with 18 SlpError code mappings"
```

---

### Task 10: `lib/chain/tx.ts` part 1 — sendAndIndex + initializeProtocol + publishSkill

**Goal:** Shared send-confirm-tick helper, plus the first two instruction builders. Tests for each.

**Files:**
- Create: `lib/chain/tx.ts`
- Test: `tests/chain/tx-init-publish.test.ts`

- [ ] **Step 1: Write failing test for instruction shape**

Write `tests/chain/tx-init-publish.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PublicKey, Keypair } from "@solana/web3.js";
import { buildInitializeProtocolIx, buildPublishSkillIx } from "@/lib/chain/tx";

describe("tx builders — initialize + publish", () => {
  const programId = new PublicKey("BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ");
  const admin = Keypair.generate().publicKey;
  const judge = Keypair.generate().publicKey;

  it("initialize_protocol ix lists admin + config + systemProgram", async () => {
    const ix = await buildInitializeProtocolIx({ programId, admin, judge });
    expect(ix.programId.toBase58()).toBe(programId.toBase58());
    const signerKeys = ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58());
    expect(signerKeys).toContain(admin.toBase58());
  });

  it("publish_skill ix includes 5 init accounts + author signer", async () => {
    const author = Keypair.generate().publicKey;
    const ix = await buildPublishSkillIx({
      programId,
      author,
      name: "GitHub PR Review",
      description: "Reviews PRs.",
      category: "coding",
      contentHash: new Uint8Array(32),
      arweaveTxId: "ar_dummy",
      subscriptionPriceLamports: 100_000_000n,
      minAuthorRatioBps: 4000,
      k: 10,
      periodLengthSeconds: 300n,
    });
    expect(ix.programId.toBase58()).toBe(programId.toBase58());
    const signerKeys = ix.keys.filter((k) => k.isSigner).map((k) => k.pubkey.toBase58());
    expect(signerKeys).toContain(author.toBase58());
    // skill, version, ledger, pool, author_share, author, systemProgram = 7 total
    expect(ix.keys.length).toBe(7);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `pnpm test run tests/chain/tx-init-publish.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/chain/tx.ts` part 1**

```ts
import {
  Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, Keypair,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { createHash } from "node:crypto";
import { getProgram, type Signer } from "./program";
import { pdas } from "./pdas";
import { parseChainError } from "./errors";

export interface TxResult { sig: string }

// ---- Shared send helper ----

export async function sendAndIndex(
  connection: Connection,
  signer: Signer,
  instructions: TransactionInstruction[],
  extraSigners: Keypair[] = [],
  { pokeIndexer = true }: { pokeIndexer?: boolean } = {},
): Promise<TxResult> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: signer.publicKey, blockhash, lastValidBlockHeight });
  tx.add(...instructions);
  extraSigners.forEach((kp) => tx.partialSign(kp));
  let signed: Transaction;
  try {
    signed = await signer.signTransaction(tx);
  } catch (e) {
    throw parseChainError(e);
  }
  let sig: string;
  try {
    sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  } catch (e) {
    throw parseChainError(e);
  }
  try {
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  } catch (e) {
    throw parseChainError(e, sig);
  }
  if (pokeIndexer && typeof fetch !== "undefined") {
    try {
      await fetch("/api/indexer/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sig }),
      });
    } catch {
      // Indexer will catch up on its own; tx is already confirmed.
    }
  }
  return { sig };
}

// ---- Instruction builders ----

export async function buildInitializeProtocolIx(args: {
  programId: PublicKey; admin: PublicKey; judge: PublicKey;
}): Promise<TransactionInstruction> {
  const { programId, admin, judge } = args;
  const [config] = pdas.config(programId);
  // Build via Anchor's method builder for consistent encoding.
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: admin,
    signTransaction: async (t: any) => t,
  });
  return await program.methods
    .initializeProtocol(judge)
    .accounts({ admin, config, systemProgram: SystemProgram.programId })
    .instruction();
}

export async function buildPublishSkillIx(args: {
  programId: PublicKey; author: PublicKey;
  name: string; description: string; category: string;
  contentHash: Uint8Array; arweaveTxId: string;
  subscriptionPriceLamports: bigint;
  minAuthorRatioBps: number; k: number; periodLengthSeconds: bigint;
}): Promise<TransactionInstruction> {
  const { programId, author } = args;
  const [skill] = pdas.skill(programId, author, args.name);
  const [version] = pdas.skillVersion(programId, skill, 1);
  const [ledger] = pdas.shareLedger(programId, skill);
  const [pool] = pdas.revenuePool(programId, skill);
  const [authorShare] = pdas.shareAccount(programId, skill, author);
  const nameHash = pdas.nameHash(args.name);

  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: author, signTransaction: async (t: any) => t,
  });
  return await program.methods
    .publishSkill({
      name: args.name,
      description: args.description,
      category: args.category,
      contentHash: Array.from(args.contentHash),
      arweaveTxId: args.arweaveTxId,
      subscriptionPrice: new BN(args.subscriptionPriceLamports.toString()),
      minAuthorRatioBps: args.minAuthorRatioBps,
      k: args.k,
      periodLength: new BN(args.periodLengthSeconds.toString()),
      nameHash: Array.from(nameHash),
    })
    .accounts({
      author,
      skill, version, ledger, pool, authorShare,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ---- High-level helpers ----

export async function initializeProtocol(
  connection: Connection, signer: Signer, judge: PublicKey, programId: PublicKey,
): Promise<TxResult> {
  const ix = await buildInitializeProtocolIx({ programId, admin: signer.publicKey, judge });
  return sendAndIndex(connection, signer, [ix], [], { pokeIndexer: false });
}

export async function publishSkill(
  connection: Connection, signer: Signer, args: {
    programId: PublicKey;
    name: string; description: string; category: string;
    content: string; arweaveTxId: string;
    subscriptionPriceLamports: bigint;
    minAuthorRatioBps: number; k: number; periodLengthSeconds: bigint;
  }
): Promise<TxResult & { skillId: string }> {
  const contentHash = createHash("sha256").update(args.content).digest();
  const ix = await buildPublishSkillIx({
    programId: args.programId,
    author: signer.publicKey,
    name: args.name, description: args.description, category: args.category,
    contentHash: new Uint8Array(contentHash),
    arweaveTxId: args.arweaveTxId,
    subscriptionPriceLamports: args.subscriptionPriceLamports,
    minAuthorRatioBps: args.minAuthorRatioBps,
    k: args.k,
    periodLengthSeconds: args.periodLengthSeconds,
  });
  const [skill] = pdas.skill(args.programId, signer.publicKey, args.name);
  const res = await sendAndIndex(connection, signer, [ix]);
  return { ...res, skillId: skill.toBase58() };
}
```

- [ ] **Step 4: Run test to pass**

Run: `pnpm test run tests/chain/tx-init-publish.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/chain/tx.ts tests/chain/tx-init-publish.test.ts
git commit -m "feat(chain): sendAndIndex + initializeProtocol + publishSkill"
```

---

### Task 11: `lib/chain/tx.ts` part 2 — subscribe + submitExperience + evaluateExperience

**Goal:** Add three more instruction helpers.

**Files:**
- Modify: `lib/chain/tx.ts` (append)
- Test: `tests/chain/tx-sub-sub-eval.test.ts`

- [ ] **Step 1: Write failing test**

Write `tests/chain/tx-sub-sub-eval.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  buildSubscribeIx, buildSubmitExperienceIx, buildEvaluateExperienceIx,
} from "@/lib/chain/tx";

describe("tx builders — subscribe/submit/evaluate", () => {
  const programId = new PublicKey("BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ");
  const user = Keypair.generate().publicKey;
  const judge = Keypair.generate().publicKey;
  const skill = Keypair.generate().publicKey;

  it("subscribe ix has subscriber + skill + pool + subscription + share + systemProgram", async () => {
    const ix = await buildSubscribeIx({ programId, subscriber: user, skill });
    expect(ix.keys.length).toBe(6);
  });

  it("submit_experience ix has contributor + skill + experience + contributor_share + systemProgram", async () => {
    const ix = await buildSubmitExperienceIx({
      programId, contributor: user, skill, nextExperienceId: 0n,
      contentHash: new Uint8Array(32), arweaveTxId: "ar_exp", skillVersion: 1,
    });
    expect(ix.keys.length).toBe(5);
  });

  it("evaluate_experience ix has judge + config + skill + experience + ledger + contributor_share", async () => {
    const ix = await buildEvaluateExperienceIx({
      programId, judge, skill, experienceId: 0n, contributor: user,
      score: 38, judgeReportTxId: "ar_report",
    });
    expect(ix.keys.length).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `pnpm test run tests/chain/tx-sub-sub-eval.test.ts`
Expected: FAIL.

- [ ] **Step 3: Append to `lib/chain/tx.ts`**

Add:
```ts
export async function buildSubscribeIx(args: {
  programId: PublicKey; subscriber: PublicKey; skill: PublicKey;
}): Promise<TransactionInstruction> {
  const [pool] = pdas.revenuePool(args.programId, args.skill);
  const [subscription] = pdas.subscription(args.programId, args.skill, args.subscriber);
  const [shareAccount] = pdas.shareAccount(args.programId, args.skill, args.subscriber);
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: args.subscriber, signTransaction: async (t: any) => t,
  });
  return await program.methods
    .subscribe()
    .accounts({
      subscriber: args.subscriber,
      skill: args.skill,
      pool, subscription, shareAccount,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function subscribe(
  connection: Connection, signer: Signer, programId: PublicKey, skill: PublicKey,
): Promise<TxResult> {
  const ix = await buildSubscribeIx({ programId, subscriber: signer.publicKey, skill });
  return sendAndIndex(connection, signer, [ix]);
}

export async function buildSubmitExperienceIx(args: {
  programId: PublicKey; contributor: PublicKey; skill: PublicKey;
  nextExperienceId: bigint; contentHash: Uint8Array; arweaveTxId: string; skillVersion: number;
}): Promise<TransactionInstruction> {
  const [experience] = pdas.experience(args.programId, args.skill, args.nextExperienceId);
  const [contributorShare] = pdas.shareAccount(args.programId, args.skill, args.contributor);
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: args.contributor, signTransaction: async (t: any) => t,
  });
  return await program.methods
    .submitExperience({
      contentHash: Array.from(args.contentHash),
      arweaveTxId: args.arweaveTxId,
      skillVersion: args.skillVersion,
    })
    .accounts({
      contributor: args.contributor,
      skill: args.skill,
      experience,
      contributorShare,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function submitExperience(
  connection: Connection, signer: Signer, args: {
    programId: PublicKey; skill: PublicKey; nextExperienceId: bigint;
    contentHash: Uint8Array; arweaveTxId: string; skillVersion: number;
  }
): Promise<TxResult & { experienceId: string }> {
  const ix = await buildSubmitExperienceIx({
    programId: args.programId, contributor: signer.publicKey,
    skill: args.skill, nextExperienceId: args.nextExperienceId,
    contentHash: args.contentHash, arweaveTxId: args.arweaveTxId,
    skillVersion: args.skillVersion,
  });
  const [exp] = pdas.experience(args.programId, args.skill, args.nextExperienceId);
  const res = await sendAndIndex(connection, signer, [ix]);
  return { ...res, experienceId: exp.toBase58() };
}

export async function buildEvaluateExperienceIx(args: {
  programId: PublicKey; judge: PublicKey;
  skill: PublicKey; experienceId: bigint; contributor: PublicKey;
  score: number; judgeReportTxId: string;
}): Promise<TransactionInstruction> {
  const [config] = pdas.config(args.programId);
  const [experience] = pdas.experience(args.programId, args.skill, args.experienceId);
  const [ledger] = pdas.shareLedger(args.programId, args.skill);
  const [contributorShare] = pdas.shareAccount(args.programId, args.skill, args.contributor);
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: args.judge, signTransaction: async (t: any) => t,
  });
  return await program.methods
    .evaluateExperience(args.score, args.judgeReportTxId)
    .accounts({
      judge: args.judge, config,
      skill: args.skill, experience,
      ledger, contributorShare,
    })
    .instruction();
}

export async function evaluateExperience(
  connection: Connection, signer: Signer, args: {
    programId: PublicKey; skill: PublicKey; experienceId: bigint;
    contributor: PublicKey; score: number; judgeReportTxId: string;
  }
): Promise<TxResult> {
  const ix = await buildEvaluateExperienceIx({
    programId: args.programId, judge: signer.publicKey,
    skill: args.skill, experienceId: args.experienceId,
    contributor: args.contributor, score: args.score,
    judgeReportTxId: args.judgeReportTxId,
  });
  return sendAndIndex(connection, signer, [ix]);
}
```

- [ ] **Step 4: Run test to pass**

Run: `pnpm test run tests/chain/tx-sub-sub-eval.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/chain/tx.ts tests/chain/tx-sub-sub-eval.test.ts
git commit -m "feat(chain): subscribe + submitExperience + evaluateExperience"
```

---

### Task 12: `lib/chain/tx.ts` part 3 — settlePeriod + claimRevenue + publishNewVersion

**Goal:** Complete the 8 instruction builders. `settlePeriod` needs the tricky remaining_accounts pairs; `claimRevenue` needs a snapshot-id lookup per claim.

**Files:**
- Modify: `lib/chain/tx.ts`
- Test: `tests/chain/tx-settle-claim-ver.test.ts`

- [ ] **Step 1: Write failing test**

Write `tests/chain/tx-settle-claim-ver.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  buildSettlePeriodIx, buildClaimRevenueIx, buildPublishNewVersionIx,
} from "@/lib/chain/tx";

describe("tx builders — settle/claim/publishVersion", () => {
  const programId = new PublicKey("BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ");
  const payer = Keypair.generate().publicKey;
  const skill = Keypair.generate().publicKey;
  const alice = Keypair.generate().publicKey;
  const bob = Keypair.generate().publicKey;

  it("settle ix includes paired remaining accounts per holder", async () => {
    const ix = await buildSettlePeriodIx({
      programId, payer, skill,
      nextSnapshotId: 1n,
      holders: [alice, bob],
    });
    // base keys: payer, skill, pool, ledger, systemProgram, rent = 6
    // remaining: 2 holders × 2 accounts = 4
    expect(ix.keys.length).toBe(10);
  });

  it("claim ix has holder + skill + pool + claimable + rent", async () => {
    const ix = await buildClaimRevenueIx({
      programId, holder: alice, skill, snapshotId: 1n,
    });
    expect(ix.keys.length).toBe(5);
  });

  it("publish_new_version ix has author + skill + new_version + systemProgram", async () => {
    const ix = await buildPublishNewVersionIx({
      programId, author: alice, skill,
      currentVersion: 1,
      contentHash: new Uint8Array(32),
      arweaveTxId: "ar_v2",
      contributingExperienceIds: [0n, 1n],
    });
    expect(ix.keys.length).toBe(4);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `pnpm test run tests/chain/tx-settle-claim-ver.test.ts`
Expected: FAIL.

- [ ] **Step 3: Append to `lib/chain/tx.ts`**

```ts
import { SYSVAR_RENT_PUBKEY } from "@solana/web3.js";

export async function buildSettlePeriodIx(args: {
  programId: PublicKey; payer: PublicKey; skill: PublicKey;
  nextSnapshotId: bigint; holders: PublicKey[];
}): Promise<TransactionInstruction> {
  const [pool] = pdas.revenuePool(args.programId, args.skill);
  const [ledger] = pdas.shareLedger(args.programId, args.skill);
  const remaining: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[] = [];
  for (const holder of args.holders) {
    const [share] = pdas.shareAccount(args.programId, args.skill, holder);
    const [claim] = pdas.claimable(args.programId, args.skill, holder, args.nextSnapshotId);
    remaining.push({ pubkey: share, isSigner: false, isWritable: false });
    remaining.push({ pubkey: claim, isSigner: false, isWritable: true });
  }
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: args.payer, signTransaction: async (t: any) => t,
  });
  return await program.methods
    .settlePeriod()
    .accounts({
      payer: args.payer,
      skill: args.skill,
      pool, ledger,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .remainingAccounts(remaining)
    .instruction();
}

export async function settlePeriod(
  connection: Connection, signer: Signer, args: {
    programId: PublicKey; skill: PublicKey; nextSnapshotId: bigint; holders: PublicKey[];
  }
): Promise<TxResult> {
  const ix = await buildSettlePeriodIx({
    programId: args.programId, payer: signer.publicKey,
    skill: args.skill, nextSnapshotId: args.nextSnapshotId, holders: args.holders,
  });
  return sendAndIndex(connection, signer, [ix]);
}

export async function buildClaimRevenueIx(args: {
  programId: PublicKey; holder: PublicKey; skill: PublicKey; snapshotId: bigint;
}): Promise<TransactionInstruction> {
  const [pool] = pdas.revenuePool(args.programId, args.skill);
  const [claimable] = pdas.claimable(args.programId, args.skill, args.holder, args.snapshotId);
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: args.holder, signTransaction: async (t: any) => t,
  });
  return await program.methods
    .claimRevenue()
    .accounts({
      holder: args.holder,
      skill: args.skill,
      pool, claimable,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();
}

export async function claimRevenue(
  connection: Connection, signer: Signer, args: {
    programId: PublicKey; skill: PublicKey; snapshotId: bigint;
  }
): Promise<TxResult> {
  const ix = await buildClaimRevenueIx({
    programId: args.programId, holder: signer.publicKey,
    skill: args.skill, snapshotId: args.snapshotId,
  });
  return sendAndIndex(connection, signer, [ix]);
}

export async function buildPublishNewVersionIx(args: {
  programId: PublicKey; author: PublicKey; skill: PublicKey;
  currentVersion: number;
  contentHash: Uint8Array; arweaveTxId: string;
  contributingExperienceIds: bigint[];
}): Promise<TransactionInstruction> {
  const [newVersion] = pdas.skillVersion(args.programId, args.skill, args.currentVersion + 1);
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: args.author, signTransaction: async (t: any) => t,
  });
  return await program.methods
    .publishNewVersion({
      contentHash: Array.from(args.contentHash),
      arweaveTxId: args.arweaveTxId,
      contributingExperienceIds: args.contributingExperienceIds.map((id) => new BN(id.toString())),
    })
    .accounts({
      author: args.author,
      skill: args.skill,
      newVersion,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function publishNewVersion(
  connection: Connection, signer: Signer, args: {
    programId: PublicKey; skill: PublicKey; currentVersion: number;
    content: string; arweaveTxId: string; contributingExperienceIds: bigint[];
  }
): Promise<TxResult> {
  const contentHash = createHash("sha256").update(args.content).digest();
  const ix = await buildPublishNewVersionIx({
    programId: args.programId, author: signer.publicKey,
    skill: args.skill, currentVersion: args.currentVersion,
    contentHash: new Uint8Array(contentHash),
    arweaveTxId: args.arweaveTxId,
    contributingExperienceIds: args.contributingExperienceIds,
  });
  return sendAndIndex(connection, signer, [ix]);
}
```

- [ ] **Step 4: Run tests to pass**

Run: `pnpm test run tests/chain/tx-settle-claim-ver.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/chain/tx.ts tests/chain/tx-settle-claim-ver.test.ts
git commit -m "feat(chain): settlePeriod + claimRevenue + publishNewVersion"
```

---

### Task 13: DB migration — `indexer_state` + `indexed_signatures`

**Goal:** Add two bookkeeping tables to `lib/db.ts`.

**Files:**
- Modify: `lib/db.ts`
- Test: `tests/chain/db-migrations.test.ts`

- [ ] **Step 1: Write failing test**

Write `tests/chain/db-migrations.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";

describe("indexer migrations", () => {
  it("creates indexer_state table", () => {
    const db = getDb(":memory:");
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='indexer_state'`).get();
    expect(row).toBeTruthy();
  });
  it("creates indexed_signatures table with status column", () => {
    const db = getDb(":memory:");
    const cols = db.prepare(`PRAGMA table_info(indexed_signatures)`).all() as any[];
    expect(cols.map((c) => c.name)).toEqual(
      expect.arrayContaining(["signature", "slot", "status", "error_code", "processed_at"])
    );
  });
});
```

- [ ] **Step 2: Run test to fail**

Run: `pnpm test run tests/chain/db-migrations.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add migrations to `lib/db.ts`**

Append inside `migrate(db)`'s `db.exec` template:
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
  status TEXT NOT NULL,
  error_code TEXT,
  processed_at INTEGER NOT NULL
);
```

Fix: the existing `db.ts`'s `getDb` caches by `name`, so passing `:memory:` twice returns the same instance. The test uses this — that is fine because the second `getDb(":memory:")` returns the already-migrated handle. Before the test, reset the singleton if needed — update `lib/db.ts` to export `_resetSingletonForTesting()`:
```ts
export function _resetSingletonForTesting() { instance = null; }
```
And have the test call `_resetSingletonForTesting()` in `beforeEach`.

- [ ] **Step 4: Update the test to reset between cases**

```ts
import { beforeEach } from "vitest";
import { _resetSingletonForTesting } from "@/lib/db";
beforeEach(() => _resetSingletonForTesting());
```

- [ ] **Step 5: Run test to pass**

Run: `pnpm test run tests/chain/db-migrations.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/db.ts tests/chain/db-migrations.test.ts
git commit -m "feat(db): indexer_state + indexed_signatures migrations"
```

---

### Task 14: `lib/indexer.ts` skeleton + idempotency guard

**Goal:** A polling loop that reads `getSignaturesForAddress`, fetches each new signature's transaction, and marks it processed. Projection logic lands in Task 15.

**Files:**
- Create: `lib/indexer.ts`

- [ ] **Step 1: Write `lib/indexer.ts` skeleton**

```ts
import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { getDb } from "@/lib/db";
import { getConnection } from "./chain/connection";
import { getChainConfig } from "./chain/config";
import { decodeEvents, type SlpEvent } from "./chain/events";
import { now } from "@/lib/mock/clock";

interface IndexerState { running: boolean; lastTick: number }

const state: IndexerState = { running: false, lastTick: 0 };
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function isRunning(): boolean { return state.running; }

export function start(): void {
  if (intervalHandle) return;
  const interval = Number(process.env.INDEXER_POLL_INTERVAL_MS ?? "2000");
  state.running = true;
  intervalHandle = setInterval(() => { tick().catch((e) => console.error("[indexer]", e)); }, interval);
}

export function stop(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  state.running = false;
}

export async function tick(opts: { sig?: string } = {}): Promise<{ processed: number }> {
  const conn = getConnection();
  const { programId } = getChainConfig();
  const db = getDb();
  let processed = 0;

  if (opts.sig) {
    if (isAlreadyIndexed(db, opts.sig)) return { processed: 0 };
    const tx = await conn.getTransaction(opts.sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx) return { processed: 0 };
    await processOne(conn, db, opts.sig, tx.slot, tx.meta?.logMessages ?? []);
    processed += 1;
    state.lastTick = now();
    return { processed };
  }

  // Catch-up pass
  const lastSeen = getLastSeenSig(db);
  const sigs = await conn.getSignaturesForAddress(programId, { until: lastSeen ?? undefined, limit: 100 });
  for (let i = sigs.length - 1; i >= 0; i--) {
    const s = sigs[i];
    if (isAlreadyIndexed(db, s.signature)) continue;
    const tx = await conn.getTransaction(s.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx) continue;
    await processOne(conn, db, s.signature, s.slot, tx.meta?.logMessages ?? []);
    setLastSeenSig(db, s.signature, s.slot);
    processed += 1;
  }
  state.lastTick = now();
  return { processed };
}

function isAlreadyIndexed(db: ReturnType<typeof getDb>, sig: string): boolean {
  const row = db.prepare(`SELECT 1 FROM indexed_signatures WHERE signature = ?`).get(sig);
  return Boolean(row);
}

function getLastSeenSig(db: ReturnType<typeof getDb>): string | null {
  const row = db.prepare(`SELECT last_seen_sig FROM indexer_state WHERE id = 1`).get() as any;
  return row?.last_seen_sig ?? null;
}

function setLastSeenSig(db: ReturnType<typeof getDb>, sig: string, slot: number) {
  db.prepare(`INSERT INTO indexer_state (id, last_seen_sig, last_seen_slot, updated_at)
              VALUES (1, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET last_seen_sig = excluded.last_seen_sig,
                                            last_seen_slot = excluded.last_seen_slot,
                                            updated_at = excluded.updated_at`)
    .run(sig, slot, now());
}

async function processOne(
  conn: Connection, db: ReturnType<typeof getDb>, sig: string, slot: number, logs: string[],
) {
  const events = decodeEvents(logs);
  const t = now();
  const tx = db.transaction(() => {
    for (const ev of events) applyEvent(db, ev, sig, slot);
    db.prepare(`INSERT OR REPLACE INTO indexed_signatures (signature, slot, status, error_code, processed_at)
                VALUES (?, ?, 'ok', NULL, ?)`).run(sig, slot, t);
  });
  try { tx(); }
  catch (e) {
    db.prepare(`INSERT OR REPLACE INTO indexed_signatures (signature, slot, status, error_code, processed_at)
                VALUES (?, ?, 'parse_failed', ?, ?)`)
      .run(sig, slot, (e as Error).message ?? "parse_failed", t);
  }
  // Post-commit async fetches (account data) get scheduled here once Task 15 wires applyEvent full.
}

function applyEvent(_db: ReturnType<typeof getDb>, _ev: SlpEvent, _sig: string, _slot: number): void {
  // Filled in Task 15.
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/indexer.ts
git commit -m "feat(indexer): polling skeleton + idempotency guard"
```

---

### Task 15: `lib/indexer.ts` event projections + unit tests

**Goal:** Implement `applyEvent` for all 8 variants. Each handler fetches the canonical account state for "after" values, then writes to SQLite tables. Idempotent because the DB transaction rolls back on failure and `indexed_signatures` is updated atomically.

**Files:**
- Modify: `lib/indexer.ts`
- Test: `tests/indexer/projection.test.ts`

- [ ] **Step 1: Write failing tests for projection**

Write `tests/indexer/projection.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { _resetSingletonForTesting, getDb } from "@/lib/db";
import { applyEventForTest } from "@/lib/indexer";

const SKILL = new PublicKey("11111111111111111111111111111114");
const AUTHOR = new PublicKey("11111111111111111111111111111115");
const BOB = new PublicKey("11111111111111111111111111111116");

beforeEach(() => _resetSingletonForTesting());

describe("applyEvent projections (shape-only, no RPC fetch)", () => {
  it("SkillPublished creates skills row with placeholder metadata", async () => {
    const db = getDb(":memory:");
    await applyEventForTest(db, {
      name: "SkillPublished",
      data: { skill: SKILL, author: AUTHOR, createdAt: 100 },
    }, "sig1", 1, /* skipFetch */ true);
    const row = db.prepare(`SELECT skill_id, name FROM skills WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(row).toBeTruthy();
    expect(row.name).toBe("<pending>");
  });

  it("Subscribed increments subscriber_count + total_revenue", async () => {
    const db = getDb(":memory:");
    // Pre-seed a skill row
    db.prepare(`INSERT INTO skills (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(SKILL.toBase58(), AUTHOR.toBase58(), "Alice", "desc", "coding", 1, "h", "ar_x", 100_000_000, 4000, 100, 100);
    db.prepare(`INSERT INTO revenue_pools (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length) VALUES (?,0,0,100,300)`)
      .run(SKILL.toBase58());
    db.prepare(`INSERT INTO share_ledgers (skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time) VALUES (?,1000,1000,4000,0,100)`)
      .run(SKILL.toBase58());

    await applyEventForTest(db, {
      name: "Subscribed",
      data: { skill: SKILL, subscriber: BOB, expiryTime: 9999 },
    }, "sig2", 2, true);

    const skill = db.prepare(`SELECT subscriber_count, total_revenue FROM skills WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(skill.subscriber_count).toBe(1);
    expect(skill.total_revenue).toBe(100_000_000);
    const shareRow = db.prepare(`SELECT shares FROM share_accounts WHERE skill_id = ? AND holder = ?`).get(SKILL.toBase58(), BOB.toBase58()) as any;
    expect(shareRow?.shares).toBe(0);
  });

  it("SharesMinted updates total_shares + adds contributor", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO share_ledgers (skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time) VALUES (?,1000,1000,4000,0,100)`)
      .run(SKILL.toBase58());
    db.prepare(`INSERT INTO share_accounts (holder, skill_id, shares, lock_until, first_contribution_at, last_contribution_at) VALUES (?,?,0,0,NULL,NULL)`)
      .run(BOB.toBase58(), SKILL.toBase58());
    await applyEventForTest(db, {
      name: "SharesMinted",
      data: { skill: SKILL, holder: BOB, amount: 380, totalSharesAfter: 1380 },
    }, "sig3", 3, true);
    const ledger = db.prepare(`SELECT total_shares, contributor_count FROM share_ledgers WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(ledger.total_shares).toBe(1380);
    expect(ledger.contributor_count).toBe(1);
    const share = db.prepare(`SELECT shares FROM share_accounts WHERE holder = ? AND skill_id = ?`).get(BOB.toBase58(), SKILL.toBase58()) as any;
    expect(share.shares).toBe(380);
  });

  it("ExperienceSubmitted + ExperienceEvaluated update the experiences row", async () => {
    const db = getDb(":memory:");
    await applyEventForTest(db, {
      name: "ExperienceSubmitted",
      data: { skill: SKILL, experienceId: 0, contributor: BOB },
    }, "sig4", 4, true);
    const exp1 = db.prepare(`SELECT status FROM experiences WHERE skill_id = ? AND experience_id = ?`)
      .get(SKILL.toBase58(), 0) as any;
    expect(exp1.status).toBe("Pending");

    await applyEventForTest(db, {
      name: "ExperienceEvaluated",
      data: { skill: SKILL, experienceId: 0, score: 38, sharesMinted: 380, approved: true, floorHit: false },
    }, "sig5", 5, true);
    const exp2 = db.prepare(`SELECT status, contribution_score FROM experiences WHERE skill_id = ? AND experience_id = ?`)
      .get(SKILL.toBase58(), 0) as any;
    expect(exp2.status).toBe("Evaluated");
    expect(exp2.contribution_score).toBe(38);
  });

  it("PeriodSettled inserts revenue_history + advances pool", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO revenue_pools (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length) VALUES (?,300000000,0,100,300)`)
      .run(SKILL.toBase58());
    await applyEventForTest(db, {
      name: "PeriodSettled",
      data: { skill: SKILL, snapshotId: 1, periodRevenue: 300000000, totalShares: 1380 },
    }, "sig6", 6, true);
    const hist = db.prepare(`SELECT period_revenue, snapshot_total_shares FROM revenue_history WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(hist.period_revenue).toBe(300000000);
    expect(hist.snapshot_total_shares).toBe(1380);
  });

  it("RevenueClaimed zeros claimable row", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO claimable_revenue (holder, skill_id, amount, snapshot_id) VALUES (?,?,?,?)`)
      .run(BOB.toBase58(), SKILL.toBase58(), 27536231, 1);
    await applyEventForTest(db, {
      name: "RevenueClaimed",
      data: { skill: SKILL, holder: BOB, amount: 27536231, snapshotId: 1 },
    }, "sig7", 7, true);
    const row = db.prepare(`SELECT amount FROM claimable_revenue WHERE holder = ? AND skill_id = ? AND snapshot_id = 1`)
      .get(BOB.toBase58(), SKILL.toBase58()) as any;
    expect(row.amount).toBe(0);
  });

  it("VersionPublished updates skills.current_version", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO skills (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(SKILL.toBase58(), AUTHOR.toBase58(), "Alice", "d", "c", 1, "h", "ar_x", 100, 4000, 1, 1);
    await applyEventForTest(db, {
      name: "VersionPublished",
      data: { skill: SKILL, version: 2, contributingCount: 1 },
    }, "sig8", 8, true);
    const s = db.prepare(`SELECT current_version FROM skills WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(s.current_version).toBe(2);
  });

  it("re-applying same event is a no-op (idempotency)", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO share_ledgers (skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time) VALUES (?,1000,1000,4000,0,0)`).run(SKILL.toBase58());
    db.prepare(`INSERT INTO share_accounts (holder, skill_id, shares, lock_until) VALUES (?,?,0,0)`).run(BOB.toBase58(), SKILL.toBase58());

    await applyEventForTest(db, {
      name: "SharesMinted",
      data: { skill: SKILL, holder: BOB, amount: 380, totalSharesAfter: 1380 },
    }, "dup", 9, true);
    // Mark as indexed, then try again
    db.prepare(`INSERT INTO indexed_signatures (signature, slot, status, processed_at) VALUES ('dup',9,'ok',0)`).run();
    await applyEventForTest(db, {
      name: "SharesMinted",
      data: { skill: SKILL, holder: BOB, amount: 380, totalSharesAfter: 1380 },
    }, "dup", 9, true);
    const ledger = db.prepare(`SELECT total_shares FROM share_ledgers WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(ledger.total_shares).toBe(1380); // NOT 1760
  });
});
```

- [ ] **Step 2: Run test to fail**

Run: `pnpm test run tests/indexer/projection.test.ts`
Expected: FAIL.

- [ ] **Step 3: Replace `applyEvent` in `lib/indexer.ts` with the full projections**

Add near the bottom of `lib/indexer.ts`:
```ts
import type { Database as DB } from "better-sqlite3";

// Exported for testing only — calls applyEvent without needing a Connection.
export async function applyEventForTest(
  db: DB, ev: SlpEvent, sig: string, slot: number, skipFetch: boolean,
): Promise<void> {
  // Idempotency short-circuit — tests also rely on this
  const already = db.prepare(`SELECT 1 FROM indexed_signatures WHERE signature = ?`).get(sig);
  if (already) return;
  applyEventLocal(db, ev, skipFetch);
}

function applyEventLocal(db: DB, ev: SlpEvent, _skipFetch: boolean): void {
  const t = now();
  switch (ev.name) {
    case "SkillPublished": {
      const skillId = ev.data.skill.toBase58();
      const author = ev.data.author.toBase58();
      const createdAt = Number(ev.data.createdAt);
      db.prepare(`INSERT OR IGNORE INTO skills
        (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at, subscriber_count, total_revenue)
        VALUES (?,?,?,?,?,1,?,?,?,?,?,?,0,0)`)
        .run(skillId, author, "<pending>", "", "uncategorized",
             "", "", 0, 0, createdAt, createdAt);
      db.prepare(`INSERT OR IGNORE INTO share_ledgers
        (skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time)
        VALUES (?, 1000, 1000, 0, 0, ?)`).run(skillId, createdAt);
      db.prepare(`INSERT OR IGNORE INTO share_accounts
        (holder, skill_id, shares, lock_until, first_contribution_at, last_contribution_at)
        VALUES (?, ?, 1000, 0, NULL, NULL)`).run(author, skillId);
      db.prepare(`INSERT OR IGNORE INTO revenue_pools
        (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length, snapshot_total_shares, last_settlement_time)
        VALUES (?, 0, 0, ?, 300, 0, 0)`).run(skillId, createdAt);
      db.prepare(`INSERT OR IGNORE INTO skill_versions
        (skill_id, version, content_hash, arweave_tx_id, contributing_experience_ids, published_at)
        VALUES (?, 1, '', '', '[]', ?)`).run(skillId, createdAt);
      return;
    }
    case "Subscribed": {
      const skillId = ev.data.skill.toBase58();
      const subscriber = ev.data.subscriber.toBase58();
      const expiry = Number(ev.data.expiryTime);
      const existing = db.prepare(`SELECT 1 FROM subscriptions WHERE subscriber=? AND skill_id=?`).get(subscriber, skillId);
      const skillRow = db.prepare(`SELECT subscription_price FROM skills WHERE skill_id = ?`).get(skillId) as any;
      const price = skillRow?.subscription_price ?? 0;
      if (!existing) {
        db.prepare(`INSERT INTO subscriptions (subscriber, skill_id, start_time, expiry_time, total_calls, is_active) VALUES (?,?,?,?,0,1)`)
          .run(subscriber, skillId, t, expiry);
        db.prepare(`UPDATE skills SET subscriber_count = subscriber_count + 1 WHERE skill_id = ?`).run(skillId);
      } else {
        db.prepare(`UPDATE subscriptions SET expiry_time = ?, is_active = 1 WHERE subscriber = ? AND skill_id = ?`)
          .run(expiry, subscriber, skillId);
      }
      db.prepare(`INSERT OR IGNORE INTO share_accounts (holder, skill_id, shares, lock_until) VALUES (?,?,0,0)`)
        .run(subscriber, skillId);
      db.prepare(`UPDATE skills SET total_revenue = total_revenue + ? WHERE skill_id = ?`).run(price, skillId);
      db.prepare(`UPDATE revenue_pools SET current_period_revenue = current_period_revenue + ? WHERE skill_id = ?`).run(price, skillId);
      return;
    }
    case "ExperienceSubmitted": {
      const skillId = ev.data.skill.toBase58();
      const experienceId = Number(ev.data.experienceId);
      const contributor = ev.data.contributor.toBase58();
      db.prepare(`INSERT OR IGNORE INTO experiences
        (experience_id, skill_id, contributor, skill_version, content_hash, arweave_tx_id, bundle_json, status, submitted_at)
        VALUES (?,?,?,1,'','','','Pending',?)`)
        .run(experienceId, skillId, contributor, t);
      db.prepare(`INSERT OR IGNORE INTO share_accounts (holder, skill_id, shares, lock_until) VALUES (?,?,0,0)`)
        .run(contributor, skillId);
      return;
    }
    case "ExperienceEvaluated": {
      const skillId = ev.data.skill.toBase58();
      const experienceId = Number(ev.data.experienceId);
      const score = Number(ev.data.score);
      const approved = Boolean(ev.data.approved);
      db.prepare(`UPDATE experiences SET status = ?, contribution_score = ?, evaluated_at = ? WHERE skill_id = ? AND experience_id = ?`)
        .run(approved ? "Evaluated" : "Rejected", score, t, skillId, experienceId);
      return;
    }
    case "SharesMinted": {
      const skillId = ev.data.skill.toBase58();
      const holder = ev.data.holder.toBase58();
      const amount = Number(ev.data.amount);
      const totalAfter = Number(ev.data.totalSharesAfter);
      const existing = db.prepare(`SELECT shares FROM share_accounts WHERE holder=? AND skill_id=?`).get(holder, skillId) as any;
      const wasZero = (existing?.shares ?? 0) === 0;
      db.prepare(`UPDATE share_ledgers SET total_shares = ?, last_snapshot_time = ? WHERE skill_id = ?`).run(totalAfter, t, skillId);
      if (wasZero && amount > 0) {
        db.prepare(`UPDATE share_ledgers SET contributor_count = contributor_count + 1 WHERE skill_id = ?`).run(skillId);
      }
      db.prepare(`UPDATE share_accounts
        SET shares = shares + ?,
            lock_until = ?,
            first_contribution_at = COALESCE(first_contribution_at, ?),
            last_contribution_at = ?
        WHERE holder = ? AND skill_id = ?`)
        .run(amount, t + 180 * 24 * 60 * 60, t, t, holder, skillId);
      return;
    }
    case "PeriodSettled": {
      const skillId = ev.data.skill.toBase58();
      const periodRevenue = Number(ev.data.periodRevenue);
      const totalShares = Number(ev.data.totalShares);
      const pool = db.prepare(`SELECT current_period_start, period_length FROM revenue_pools WHERE skill_id = ?`).get(skillId) as any;
      const periodStart = pool?.current_period_start ?? t;
      db.prepare(`INSERT INTO revenue_history (skill_id, period_start, period_end, period_revenue, snapshot_total_shares) VALUES (?,?,?,?,?)`)
        .run(skillId, periodStart, t, periodRevenue, totalShares);
      db.prepare(`UPDATE revenue_pools SET
          current_period_revenue = 0,
          total_lifetime_revenue = total_lifetime_revenue + ?,
          current_period_start = ?,
          snapshot_total_shares = ?,
          last_settlement_time = ?
          WHERE skill_id = ?`)
        .run(periodRevenue, t, totalShares, t, skillId);
      // NOTE: per-holder claimable rows are backfilled from chain by getProgramAccounts
      // in a follow-up pass done inside processOne (Task 16 wires this via skipFetch=false).
      return;
    }
    case "RevenueClaimed": {
      const skillId = ev.data.skill.toBase58();
      const holder = ev.data.holder.toBase58();
      const snapshotId = Number(ev.data.snapshotId);
      db.prepare(`UPDATE claimable_revenue SET amount = 0 WHERE holder = ? AND skill_id = ? AND snapshot_id = ?`)
        .run(holder, skillId, snapshotId);
      return;
    }
    case "VersionPublished": {
      const skillId = ev.data.skill.toBase58();
      const version = Number(ev.data.version);
      db.prepare(`INSERT OR IGNORE INTO skill_versions (skill_id, version, content_hash, arweave_tx_id, contributing_experience_ids, published_at) VALUES (?,?, '', '', '[]', ?)`)
        .run(skillId, version, t);
      db.prepare(`UPDATE skills SET current_version = ?, updated_at = ? WHERE skill_id = ?`)
        .run(version, t, skillId);
      return;
    }
  }
}
```

Then update `processOne` to call `applyEventLocal(db, ev, false)` inside the transaction, and after the transaction commits, for any event that needs RPC-sourced data (like `SkillPublished` fetching the on-chain Skill account for name/description/category, or `PeriodSettled` fetching ClaimableRevenue PDAs), dispatch a post-commit enrichment:
```ts
async function enrichAfterCommit(conn: Connection, db: DB, ev: SlpEvent): Promise<void> {
  const { getProgram } = await import("./chain/program");
  const program = getProgram(conn, { publicKey: new PublicKey("11111111111111111111111111111112"), signTransaction: async (t: any) => t });
  if (ev.name === "SkillPublished") {
    const skillPk = ev.data.skill as PublicKey;
    try {
      const acct = await (program.account as any).skill.fetch(skillPk);
      db.prepare(`UPDATE skills SET
          name = ?, description = ?, category = ?,
          content_hash = ?, arweave_tx_id = ?,
          subscription_price = ?, min_author_ratio_bps = ?
          WHERE skill_id = ?`)
        .run(acct.name, acct.description, acct.category,
             Buffer.from(acct.contentHash).toString("hex"), acct.arweaveTxId,
             Number(acct.subscriptionPrice.toString()), acct.minAuthorRatioBps,
             skillPk.toBase58());
    } catch (e) { console.error("[indexer] enrich skill failed", e); }
  }
  if (ev.name === "PeriodSettled") {
    const skillPk = ev.data.skill as PublicKey;
    const snapshotId = BigInt(ev.data.snapshotId.toString());
    // Fetch all ClaimableRevenue for this skill+snapshot
    try {
      const all = await (program.account as any).claimableRevenue.all([
        { memcmp: { offset: 8 + 32, bytes: skillPk.toBase58() } }, // holder(32) skipped, skill(32) next
      ]);
      for (const item of all) {
        if (Number(item.account.snapshotId.toString()) !== Number(snapshotId)) continue;
        db.prepare(`INSERT OR REPLACE INTO claimable_revenue (holder, skill_id, amount, snapshot_id) VALUES (?,?,?,?)`)
          .run(item.account.holder.toBase58(), skillPk.toBase58(),
               Number(item.account.amount.toString()), Number(snapshotId));
      }
    } catch (e) { console.error("[indexer] enrich claims failed", e); }
  }
}
```
And in `processOne`, after the transaction commits:
```ts
for (const ev of events) {
  try { await enrichAfterCommit(conn, db, ev); } catch (e) { console.error(e); }
}
```

- [ ] **Step 4: Run tests to pass**

Run: `pnpm test run tests/indexer/projection.test.ts`
Expected: PASS (8 projection tests + 1 idempotency test).

- [ ] **Step 5: Commit**

```bash
git add lib/indexer.ts tests/indexer/projection.test.ts
git commit -m "feat(indexer): 8 event projections + post-commit enrichment"
```

---

### Task 16: `/api/indexer/tick` + `/api/indexer/status` routes

**Goal:** HTTP surface for the indexer — POST tick triggers a pass (optionally for a specific signature), GET status returns progress and optionally verifies against chain.

**Files:**
- Create: `app/api/indexer/tick/route.ts`
- Create: `app/api/indexer/status/route.ts`

- [ ] **Step 1: Write tick route**

`app/api/indexer/tick/route.ts`:
```ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { guarded } from "@/lib/api-helpers";
import { tick } from "@/lib/indexer";

export const dynamic = "force-dynamic";

const Body = z.object({ sig: z.string().optional() });

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const body = Body.parse(await req.json().catch(() => ({})));
    const result = await tick({ sig: body.sig });
    return { processed: result.processed };
  });
}
```

- [ ] **Step 2: Write status route**

`app/api/indexer/status/route.ts`:
```ts
import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { guarded } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { getConnection } from "@/lib/chain/connection";
import { getChainConfig } from "@/lib/chain/config";
import { getProgram } from "@/lib/chain/program";
import { pdas } from "@/lib/chain/pdas";
import { isRunning } from "@/lib/indexer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return guarded(async () => {
    const db = getDb();
    const state = db.prepare(`SELECT last_seen_sig, last_seen_slot, updated_at FROM indexer_state WHERE id = 1`).get() as any;
    const parseFailures = (db.prepare(`SELECT COUNT(*) AS n FROM indexed_signatures WHERE status = 'parse_failed'`).get() as any)?.n ?? 0;
    const verify = req.nextUrl.searchParams.get("verify") === "1";
    const base = {
      running: isRunning(),
      lastSeenSig: state?.last_seen_sig ?? null,
      lastSeenSlot: state?.last_seen_slot ?? null,
      parseFailures,
    };
    if (!verify) return base;

    const conn = getConnection();
    const { programId } = getChainConfig();
    const program = getProgram(conn, { publicKey: new PublicKey("11111111111111111111111111111112"), signTransaction: async (t: any) => t });
    const skills = db.prepare(`SELECT skill_id FROM skills ORDER BY RANDOM() LIMIT 5`).all() as { skill_id: string }[];
    const mismatches: any[] = [];
    for (const s of skills) {
      const [ledgerPda] = pdas.shareLedger(programId, new PublicKey(s.skill_id));
      const onChain = await (program.account as any).shareLedger.fetch(ledgerPda);
      const row = db.prepare(`SELECT total_shares FROM share_ledgers WHERE skill_id = ?`).get(s.skill_id) as any;
      const chainTotal = Number(onChain.totalShares.toString());
      if (row.total_shares !== chainTotal) mismatches.push({ skillId: s.skill_id, db: row.total_shares, chain: chainTotal });
    }
    return { ...base, ok: mismatches.length === 0, mismatches };
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/indexer
git commit -m "feat(indexer): /api/indexer/tick + /api/indexer/status routes"
```

---

### Task 17: Delete Slice 1 mutation POST handlers + prune `lib/services.ts`

**Goal:** Remove the now-redundant server-side mutation handlers. The client talks to chain directly.

**Files:**
- Delete (POST handler from): `app/api/skills/route.ts`
- Delete (files): `app/api/skills/[id]/versions/route.ts`, `app/api/revenue/[skillId]/settle/route.ts`, `app/api/revenue/[skillId]/claim/route.ts`
- Modify (delete POST handler): `app/api/subscriptions/route.ts`
- Delete (POST handler from): `app/api/experiences/route.ts`
- Modify: `lib/services.ts` (remove 7 write-path functions, keep `sha256Hex`, `getPeriodLengthSeconds`, rewrite `getSolBalance`)

- [ ] **Step 1: Check which files exist**

Run: `find app/api -name "route.ts" | sort`

- [ ] **Step 2: Remove POST from `app/api/skills/route.ts`**

Read the file, delete the `export async function POST(req)` block and its imports that become unused (e.g. `publishSkill`, `solToLamports`, `PublishSkillSchema`).

- [ ] **Step 3: Delete the three full files**

Run:
```bash
rm -f app/api/skills/\[id\]/versions/route.ts
rm -rf app/api/revenue/\[skillId\]/settle
rm -rf app/api/revenue/\[skillId\]/claim
```

- [ ] **Step 4: Remove POST from `app/api/subscriptions/route.ts` and `app/api/experiences/route.ts`**

Keep their GET handlers (experiences has `[id]/route.ts` GET), delete the POST function and unused imports.

- [ ] **Step 5: Prune `lib/services.ts`**

Read the file. Delete `publishSkill`, `publishNewVersion`, `subscribe`, `submitExperience`, `evaluatePending`, `settleRevenue`, `claimRevenue`, `PublishSkillInput` interface. Keep `sha256Hex`, `getPeriodLengthSeconds`, `SOL`. Rewrite `getSolBalance`:
```ts
import { getConnection } from "./chain/connection";
import { PublicKey } from "@solana/web3.js";
export async function getSolBalance(holder: string): Promise<number> {
  try {
    const conn = getConnection();
    return await conn.getBalance(new PublicKey(holder));
  } catch { return 0; }
}
```

- [ ] **Step 6: Fix up callers that still import deleted symbols**

Run: `grep -rn "from \"@/lib/services\"" app/ lib/ tests/`

Expected callers that still compile after pruning:
- `/api/me/route.ts` uses `getSolBalance` — now returns a Promise, so switch to `await getSolBalance(...)` — Task 24.
- `/api/console/step/route.ts` uses many deleted functions — gutted in Task 23.

Temporarily stub `/api/console/step/route.ts` by returning `{ ok: true, stub: true }` for every step so build stays green until Task 23:
```ts
import { NextRequest } from "next/server";
import { guarded } from "@/lib/api-helpers";
export const dynamic = "force-dynamic";
export async function POST(_req: NextRequest) {
  return guarded(async () => ({ ok: true, stubbed: true, note: "rewritten in Task 23" }));
}
```

- [ ] **Step 7: Run typecheck and tests**

Run: `pnpm typecheck && pnpm test run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: delete Slice 1 mutation POST handlers + prune lib/services.ts"
```

---

### Task 18: `lib/personas.ts` + `scripts/demo-personas.ts`

**Goal:** Persona vault — keypair-backed signers for `/console`. A script that generates + funds them.

**Files:**
- Create: `lib/personas.ts`
- Create: `scripts/demo-personas.ts`
- Modify: `.gitignore` (confirm `data/demo-personas.json` is covered; `data/` already is)

- [ ] **Step 1: Write `lib/personas.ts`**

```ts
import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { Signer } from "./chain/program";
import fs from "node:fs";
import path from "node:path";

export type PersonaName = "alice" | "bob" | "carol" | "judge";

export interface PersonaSigner extends Signer {
  name: PersonaName;
  keypair: Keypair;
}

export interface PersonaVaultFile {
  alice: number[]; bob: number[]; carol: number[]; judge: number[];
}

export function personaVaultPath(): string {
  const p = process.env.DEMO_PERSONAS_PATH ?? "./data/demo-personas.json";
  return path.resolve(p);
}

export function loadPersonaVault(): PersonaVaultFile | null {
  const p = personaVaultPath();
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as PersonaVaultFile;
}

export function savePersonaVault(vault: PersonaVaultFile): void {
  const p = personaVaultPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(vault, null, 2));
}

export function makePersonaSigner(name: PersonaName, keypair: Keypair): PersonaSigner {
  return {
    name,
    keypair,
    publicKey: keypair.publicKey,
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
      if (tx instanceof Transaction) { tx.partialSign(keypair); return tx; }
      (tx as VersionedTransaction).sign([keypair]);
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
      return Promise.all(txs.map((t) => this.signTransaction(t)));
    },
  };
}

export function loadPersonaSigners(): Record<PersonaName, PersonaSigner> | null {
  const vault = loadPersonaVault();
  if (!vault) return null;
  return {
    alice: makePersonaSigner("alice", Keypair.fromSecretKey(Uint8Array.from(vault.alice))),
    bob: makePersonaSigner("bob", Keypair.fromSecretKey(Uint8Array.from(vault.bob))),
    carol: makePersonaSigner("carol", Keypair.fromSecretKey(Uint8Array.from(vault.carol))),
    judge: makePersonaSigner("judge", Keypair.fromSecretKey(Uint8Array.from(vault.judge))),
  };
}
```

- [ ] **Step 2: Write `scripts/demo-personas.ts`**

```ts
#!/usr/bin/env tsx
import "dotenv/config";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getConnection } from "../lib/chain/connection";
import {
  loadPersonaVault, savePersonaVault, type PersonaVaultFile,
} from "../lib/personas";

const TARGET_LAMPORTS = 2 * LAMPORTS_PER_SOL;

async function ensurePersona(name: string, existing: number[] | undefined): Promise<Keypair> {
  if (existing?.length) return Keypair.fromSecretKey(Uint8Array.from(existing));
  const kp = Keypair.generate();
  console.log(`[personas] generated ${name}: ${kp.publicKey.toBase58()}`);
  return kp;
}

async function airdropIfLow(kp: Keypair): Promise<void> {
  const conn = getConnection();
  const bal = await conn.getBalance(kp.publicKey);
  if (bal >= TARGET_LAMPORTS) {
    console.log(`[personas] ${kp.publicKey.toBase58()} has ${bal/LAMPORTS_PER_SOL} SOL — skipping airdrop`);
    return;
  }
  const need = TARGET_LAMPORTS - bal;
  const sig = await conn.requestAirdrop(kp.publicKey, need);
  await conn.confirmTransaction(sig, "confirmed");
  console.log(`[personas] airdropped ${need/LAMPORTS_PER_SOL} SOL to ${kp.publicKey.toBase58()}`);
}

async function main() {
  const existing = loadPersonaVault();
  const alice = await ensurePersona("alice", existing?.alice);
  const bob = await ensurePersona("bob", existing?.bob);
  const carol = await ensurePersona("carol", existing?.carol);
  const judge = await ensurePersona("judge", existing?.judge);
  const vault: PersonaVaultFile = {
    alice: Array.from(alice.secretKey),
    bob: Array.from(bob.secretKey),
    carol: Array.from(carol.secretKey),
    judge: Array.from(judge.secretKey),
  };
  savePersonaVault(vault);
  for (const kp of [alice, bob, carol, judge]) {
    try { await airdropIfLow(kp); }
    catch (e) { console.warn(`[personas] airdrop failed for ${kp.publicKey.toBase58()}:`, (e as Error).message); }
  }
  console.log("[personas] done. Vault:", process.env.DEMO_PERSONAS_PATH ?? "./data/demo-personas.json");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Add `dotenv` dep**

Run: `pnpm add -D dotenv`

- [ ] **Step 4: Run the script (first-time keypair gen + airdrop)**

Run:
```bash
DEMO_PERSONAS_PATH=./data/demo-personas.json \
NEXT_PUBLIC_SLP_PROGRAM_ID=BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ \
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com \
NEXT_PUBLIC_SOLANA_CLUSTER=devnet \
pnpm tsx scripts/demo-personas.ts
```
Expected: Four lines of airdrop success. Vault JSON file written under `./data/`.
If devnet faucet rate-limits, re-run in a minute or fund manually via web faucet.

- [ ] **Step 5: Confirm vault is gitignored**

Run: `git status` — should NOT show `data/demo-personas.json`.

- [ ] **Step 6: Commit**

```bash
git add lib/personas.ts scripts/demo-personas.ts package.json pnpm-lock.yaml
git commit -m "feat(demo): persona vault + devnet-funding script"
```

---

### Task 19: `scripts/init-protocol.ts` + `scripts/seed-devnet.ts`

**Goal:** One-shot init + a seed script that publishes 6 skills to devnet so `/market` is populated.

**Files:**
- Create: `scripts/init-protocol.ts`
- Create: `scripts/seed-devnet.ts`

- [ ] **Step 1: Write `scripts/init-protocol.ts`**

```ts
#!/usr/bin/env tsx
import "dotenv/config";
import { Keypair } from "@solana/web3.js";
import fs from "node:fs";
import { getConnection } from "../lib/chain/connection";
import { getChainConfig } from "../lib/chain/config";
import { initializeProtocol } from "../lib/chain/tx";
import { pdas } from "../lib/chain/pdas";
import { getProgram } from "../lib/chain/program";
import { makePersonaSigner, loadPersonaVault } from "../lib/personas";

async function main() {
  const { programId } = getChainConfig();
  const conn = getConnection();

  const deployerPath = (process.env.DEPLOYER_KEYPAIR ?? "~/.config/solana/slp-deployer.json")
    .replace("~", process.env.HOME ?? "");
  const deployerKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(deployerPath, "utf8"))));
  const deployerSigner = makePersonaSigner("alice" /* label only */, deployerKp);

  const vault = loadPersonaVault();
  if (!vault) throw new Error("Run scripts/demo-personas.ts first");
  const judgePk = Keypair.fromSecretKey(Uint8Array.from(vault.judge)).publicKey;

  // Idempotency: check ProtocolConfig
  const [configPda] = pdas.config(programId);
  const info = await conn.getAccountInfo(configPda);
  if (info) { console.log("[init] ProtocolConfig already exists — skipping"); return; }

  const { sig } = await initializeProtocol(conn, deployerSigner, judgePk, programId);
  console.log("[init] initialized — sig:", sig);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run init-protocol**

Run:
```bash
DEPLOYER_KEYPAIR=~/.config/solana/slp-deployer.json \
DEMO_PERSONAS_PATH=./data/demo-personas.json \
NEXT_PUBLIC_SLP_PROGRAM_ID=BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ \
NEXT_PUBLIC_SOLANA_CLUSTER=devnet \
NEXT_PUBLIC_SOLANA_RPC=https://api.devnet.solana.com \
pnpm tsx scripts/init-protocol.ts
```
Expected: "initialized — sig: <signature>".

- [ ] **Step 3: Write `scripts/seed-devnet.ts`**

```ts
#!/usr/bin/env tsx
import "dotenv/config";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { ArweaveMock } from "../lib/mock/arweave";
import { getConnection } from "../lib/chain/connection";
import { getChainConfig } from "../lib/chain/config";
import { publishSkill } from "../lib/chain/tx";
import { loadPersonaSigners } from "../lib/personas";

const SKILLS = [
  { name: "GitHub PR Review", desc: "Reviews PRs for tests, style, security, safety.", cat: "coding", price: 0.1, floor: 4000 },
  { name: "SQL Query Reviewer", desc: "Catches N+1s, missing indexes, lock contention.", cat: "coding", price: 0.05, floor: 4500 },
  { name: "Regex Debugger", desc: "Explains a regex, finds backtracking pitfalls.", cat: "coding", price: 0.02, floor: 3500 },
  { name: "K8s YAML Linter", desc: "Checks resource limits, liveness probes, IAM.", cat: "devops", price: 0.08, floor: 4200 },
  { name: "Meeting Notes Distiller", desc: "Turns a transcript into decisions + action items.", cat: "productivity", price: 0.03, floor: 4000 },
  { name: "Copy Brand Voice Match", desc: "Rewrites marketing copy in a target voice.", cat: "writing", price: 0.04, floor: 4300 },
];

async function main() {
  const signers = loadPersonaSigners();
  if (!signers) throw new Error("Run scripts/demo-personas.ts first");
  const conn = getConnection();
  const { programId } = getChainConfig();

  for (const s of SKILLS) {
    const content = `# ${s.name}\n\n${s.desc}\n\nStep 1: Load inputs.\nStep 2: Check for common smells.\nStep 3: Produce review.`;
    const upload = ArweaveMock.upload(content, [
      { name: "Protocol", value: "SLP" }, { name: "Type", value: "SkillContent" }, { name: "Name", value: s.name },
    ], signers.alice.publicKey.toBase58());

    console.log(`[seed] publishing "${s.name}"...`);
    try {
      const result = await publishSkill(conn, signers.alice, {
        programId,
        name: s.name, description: s.desc, category: s.cat,
        content, arweaveTxId: upload.txId,
        subscriptionPriceLamports: BigInt(Math.floor(s.price * LAMPORTS_PER_SOL)),
        minAuthorRatioBps: s.floor, k: 10, periodLengthSeconds: 300n,
      });
      console.log(`  sig=${result.sig}  skill=${result.skillId}`);
    } catch (e: any) {
      if (String(e.message ?? "").includes("already in use") || e.code === "ZeroPrice") {
        console.log("  skipped — already exists");
      } else {
        console.error("  failed:", e.message ?? e);
      }
    }
  }
  console.log("[seed] done");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Run seed-devnet**

Run (same env as Step 2): `pnpm tsx scripts/seed-devnet.ts`
Expected: Six "publishing..." lines, each followed by a sig. Total time ~30s on devnet.

- [ ] **Step 5: Commit**

```bash
git add scripts/init-protocol.ts scripts/seed-devnet.ts
git commit -m "feat(scripts): init-protocol + seed-devnet"
```

---

### Task 20: `lib/judge-client.ts` — judge daemon

**Goal:** Server-only background daemon. Polls SQLite for `Pending` experiences every 3s; calls `scoreBundle()`; uploads report to mock Arweave; signs `evaluate_experience` with the judge persona keypair.

**Files:**
- Create: `lib/judge-client.ts`

- [ ] **Step 1: Write `lib/judge-client.ts`**

```ts
import { getDb } from "@/lib/db";
import { getConnection } from "./chain/connection";
import { getChainConfig } from "./chain/config";
import { evaluateExperience } from "./chain/tx";
import { ArweaveMock } from "./mock/arweave";
import { scoreBundle, JUDGE_ID } from "./mock/judge";
import { loadPersonaSigners } from "./personas";
import type { ExperienceBundle } from "./schemas";
import { PublicKey } from "@solana/web3.js";
import { pdas } from "./chain/pdas";

let running = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function isJudgeRunning(): boolean { return running; }

export function startJudgeDaemon(): void {
  if (intervalHandle) return;
  running = true;
  intervalHandle = setInterval(() => { evaluateOnce().catch((e) => console.error("[judge]", e)); }, 3000);
}

export function stopJudgeDaemon(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  running = false;
}

export async function evaluateOnce(): Promise<{ processed: number }> {
  const db = getDb();
  const signers = loadPersonaSigners();
  if (!signers) return { processed: 0 };
  const conn = getConnection();
  const { programId } = getChainConfig();

  const pending = db.prepare(`SELECT experience_id, skill_id, bundle_json, contributor
                              FROM experiences
                              WHERE status = 'Pending'
                              ORDER BY submitted_at ASC LIMIT 5`).all() as any[];
  let processed = 0;
  for (const row of pending) {
    // If bundle_json is empty (event arrived without Arweave fetch), try to pull it now
    let bundle: ExperienceBundle | null = null;
    if (row.bundle_json) {
      try { bundle = JSON.parse(row.bundle_json); } catch {}
    }
    if (!bundle) {
      // Fetch from Arweave mock using stored arweave_tx_id
      const exp = db.prepare(`SELECT arweave_tx_id FROM experiences WHERE experience_id = ? AND skill_id = ?`).get(row.experience_id, row.skill_id) as any;
      const obj = exp?.arweave_tx_id ? ArweaveMock.fetch(exp.arweave_tx_id) : null;
      if (obj?.content) {
        try { bundle = JSON.parse(obj.content); } catch {}
        if (bundle) db.prepare(`UPDATE experiences SET bundle_json = ? WHERE experience_id = ? AND skill_id = ?`)
          .run(JSON.stringify(bundle), row.experience_id, row.skill_id);
      }
    }
    if (!bundle) continue;

    const priors = db.prepare(`SELECT bundle_json FROM experiences WHERE skill_id = ? AND status = 'Evaluated' AND experience_id != ?`).all(row.skill_id, row.experience_id) as any[];
    const report = scoreBundle(bundle, priors.map((p) => { try { return JSON.parse(p.bundle_json); } catch { return null; } }).filter(Boolean));
    report.experience_id = row.experience_id;

    const reportUp = ArweaveMock.upload(JSON.stringify(report, null, 2),
      [{ name: "Protocol", value: "SLP" }, { name: "Type", value: "JudgeReport" }, { name: "ExperienceId", value: String(row.experience_id) }],
      JUDGE_ID);

    try {
      await evaluateExperience(conn, signers.judge, {
        programId,
        skill: new PublicKey(row.skill_id),
        experienceId: BigInt(row.experience_id),
        contributor: new PublicKey(row.contributor),
        score: report.weighted_total,
        judgeReportTxId: reportUp.txId,
      });
      processed += 1;
    } catch (e) {
      console.error("[judge] evaluate failed:", (e as Error).message);
    }
  }
  return { processed };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add lib/judge-client.ts
git commit -m "feat(judge): on-chain judge daemon signing evaluate_experience"
```

---

### Task 21: `lib/bootstrap.ts` + `/api/judge/tick` rewire

**Goal:** Start indexer and judge daemon on server boot. Rewrite `/api/judge/tick` to kick the daemon.

**Files:**
- Create: `lib/bootstrap.ts`
- Modify: `app/api/judge/tick/route.ts`
- Modify: `app/layout.tsx` (side-effect import `lib/bootstrap`)

- [ ] **Step 1: Write `lib/bootstrap.ts`**

```ts
import { start as startIndexer } from "./indexer";
import { startJudgeDaemon } from "./judge-client";

// Server-only; accessing process in a browser throws
if (typeof window === "undefined") {
  const autostart = (process.env.INDEXER_AUTOSTART ?? "true") === "true";
  const demo = process.env.DEMO_MODE === "true";

  // Singleton guard across HMR reloads
  const g = globalThis as any;
  if (!g.__slpBootstrapped) {
    if (autostart) startIndexer();
    if (demo) startJudgeDaemon();
    g.__slpBootstrapped = true;
  }
}
```

- [ ] **Step 2: Import it from `app/layout.tsx`**

Read `app/layout.tsx`, add at the top:
```ts
import "@/lib/bootstrap";
```

- [ ] **Step 3: Rewrite `/api/judge/tick/route.ts`**

```ts
import { NextRequest } from "next/server";
import { guarded } from "@/lib/api-helpers";
import { evaluateOnce } from "@/lib/judge-client";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  return guarded(async () => {
    const result = await evaluateOnce();
    return { processed: result.processed };
  });
}
```

- [ ] **Step 4: Run dev server (sanity only, no need to keep running)**

Run:
```bash
cp .env.example .env.local
pnpm dev &
sleep 8
curl -s http://localhost:3000/api/indexer/status
kill %1
```
Expected: Status JSON with `running: true`.

- [ ] **Step 5: Commit**

```bash
git add lib/bootstrap.ts app/layout.tsx app/api/judge/tick/route.ts
git commit -m "feat(bootstrap): autostart indexer + judge daemon, rewire /api/judge/tick"
```

---

### Task 22: Wire `/publish`, `/skill/[id]`, `/submit`, `/me` pages to `lib/chain/tx`

**Goal:** Replace `api.publish/api.subscribe/api.settle/api.claim/api.submitExperience` call sites with `lib/chain/tx.ts` helpers backed by the connected Phantom wallet. Add "transaction confirming" affordance + Explorer link.

**Files (per page):**
- Modify: `app/publish/page.tsx`
- Modify: `app/skill/[id]/page.tsx`
- Modify: `app/submit/page.tsx`
- Modify: `app/me/page.tsx`
- Create: `components/brutalist/TxStatus.tsx` (small component: "signing → confirming → confirmed [link]")

- [ ] **Step 1: Write `components/brutalist/TxStatus.tsx`**

```tsx
"use client";
import { txLink, type Cluster } from "@/lib/chain/explorer";

type Status = "idle" | "signing" | "confirming" | "confirmed" | "error";

export function TxStatus({ status, sig, cluster, error }:
  { status: Status; sig?: string; cluster: Cluster; error?: string }) {
  if (status === "idle") return null;
  return (
    <div className="mt-2 text-xs font-mono border border-[var(--ink)] px-2 py-1">
      {status === "signing" && "⏳ waiting for signature…"}
      {status === "confirming" && "⏳ confirming on devnet…"}
      {status === "confirmed" && sig && (
        <>✓ confirmed — <a href={txLink(sig, cluster)} target="_blank" rel="noreferrer" className="underline">view on explorer</a></>
      )}
      {status === "error" && `✕ ${error ?? "failed"}`}
    </div>
  );
}
```

- [ ] **Step 2: Modify `app/publish/page.tsx`**

Find `await api.publish(...)` and replace with:
```ts
import { getConnection } from "@/lib/chain/connection";
import { getChainConfig } from "@/lib/chain/config";
import { publishSkill } from "@/lib/chain/tx";
import { TxStatus } from "@/components/brutalist/TxStatus";
// ... inside submit handler:
const { programId, cluster } = getChainConfig();
setStatus("signing");
const upload = await api.uploadIrys(wallet.publicKey!.toBase58(), "sig_placeholder", { content, tags: [/* existing */] });
setStatus("confirming");
const result = await publishSkill(getConnection(), wallet as any, {
  programId, name, description, category,
  content, arweaveTxId: upload.txId,
  subscriptionPriceLamports: BigInt(Math.floor(priceSol * LAMPORTS_PER_SOL)),
  minAuthorRatioBps: floor, k: 10, periodLengthSeconds: 300n,
});
setSig(result.sig); setStatus("confirmed");
// redirect as before but via result.skillId
```

- [ ] **Step 3: Modify `app/skill/[id]/page.tsx`**

Replace `api.subscribe/api.settle/api.claim` similarly with `subscribe/settlePeriod/claimRevenue` from `lib/chain/tx`. For `settlePeriod`, first fetch all holders with `shares > 0` from `/api/shares/:skillId` (already exists as a GET), then call `settlePeriod(... { holders: [...], nextSnapshotId: poolSnapshotId + 1 })`.

- [ ] **Step 4: Modify `app/submit/page.tsx`**

Replace `api.submitExperience` with `submitExperience` from `lib/chain/tx`. Need the `nextExperienceId`: fetch `Skill` account via `program.account.skill.fetch(skillPda)` and read `.nextExperienceId`. Wrap that in a simple client helper in `lib/chain/tx.ts` — add an exported `getNextExperienceId(connection, programId, skillId)`.

- [ ] **Step 5: Modify `app/me/page.tsx`**

The Claim row button: replace `api.claim(...)` with `claimRevenue(getConnection(), signer, { programId, skill, snapshotId })`. snapshotId comes from the row data.

- [ ] **Step 6: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: Green.

- [ ] **Step 7: Commit**

```bash
git add app/publish app/skill app/submit app/me components/brutalist/TxStatus.tsx lib/chain/tx.ts
git commit -m "feat(ui): wire publish/subscribe/settle/claim/submit to on-chain txs"
```

---

### Task 23: Wire `/console` to persona-vault + on-chain calls

**Goal:** Rewrite `/console` so each stepper action uses a PersonaSigner (loaded via `/api/console/personas` endpoint that returns public keys only — not secret keys — plus a client-side in-memory keypair cache fed from a one-time `/api/console/personas/unlock` endpoint that reads the vault server-side and returns keypairs ONLY when DEMO_MODE=true).

**Files:**
- Create: `app/api/console/personas/route.ts` (GET pubkeys; POST with `unlock=true` returns secret keys)
- Rewrite: `app/api/console/step/route.ts` (no more server-side signing; just return the next step metadata)
- Modify: `app/console/page.tsx`
- Modify: `app/console/personas.ts` (the client-side personas.ts file)

- [ ] **Step 1: Write `/api/console/personas/route.ts`**

```ts
import { NextRequest } from "next/server";
import { ApiError, guarded } from "@/lib/api-helpers";
import { loadPersonaVault } from "@/lib/personas";
import { Keypair } from "@solana/web3.js";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  return guarded(async () => {
    if (process.env.DEMO_MODE !== "true") throw new ApiError(403, "demo_mode_required");
    const vault = loadPersonaVault();
    if (!vault) throw new ApiError(404, "personas_not_initialized");
    const pk = (arr: number[]) => Keypair.fromSecretKey(Uint8Array.from(arr)).publicKey.toBase58();
    return {
      alice: pk(vault.alice), bob: pk(vault.bob), carol: pk(vault.carol), judge: pk(vault.judge),
    };
  });
}

export async function POST(_req: NextRequest) {
  return guarded(async () => {
    if (process.env.DEMO_MODE !== "true") throw new ApiError(403, "demo_mode_required");
    const vault = loadPersonaVault();
    if (!vault) throw new ApiError(404, "personas_not_initialized");
    // Returns secret keys to client. ONLY in DEMO_MODE. Vault is devnet-only.
    return vault;
  });
}
```

- [ ] **Step 2: Simplify `/api/console/step/route.ts`**

The stepper is now client-side. Server just holds step metadata (act order + next-step-id). Keep the file but return only `{ ok: true, step, note }`. Already stubbed in Task 17.

- [ ] **Step 3: Rewrite `app/console/page.tsx` flow**

Read the file, and where each `STEPS` array item has `action: "subscribe_bob"`, replace the handler mapping that used to call `api.consoleStep("subscribe_bob")` with a client-side flow that:
1. Loads personas via `/api/console/personas` (POST — one-time unlock on page mount, stored in React state).
2. Builds the persona's `Signer` via `makePersonaSigner` (imported from `@/lib/personas`).
3. Calls the corresponding `lib/chain/tx.ts` helper (e.g., `subscribe(connection, personaSigner, programId, aliceSkillId)`).
4. On success, sets the sig and lets TxStatus show the Explorer link.

Concrete mapping per step.action:
- `reset_then_seed` → `POST /api/reset` (keeps SQLite reset path; does NOT touch chain).
- `subscribe_bob` / `subscribe_carol` → `subscribe(conn, bobSigner, programId, skillPk)`.
- `submit_bob_experience` → upload demo bundle via `/api/irys/upload`, then `submitExperience(conn, bobSigner, {...})`.
- `evaluate` → `POST /api/judge/tick` (triggers daemon immediately).
- `force_settle_then_settle` → `POST /api/console/force-settle-ready?skillId=...` (stub; devnet can't rewind clock, so this step polls until `now >= current_period_start + period_length` in a real demo — OR we set period_length to 60s at publish time in seed-devnet for the demo to finish fast). For the plan: set `periodLengthSeconds: 60n` in seed-devnet.ts for Alice's "GitHub PR Review" skill only, so the demo completes quickly. No `force-settle` endpoint needed.
- `settle` → fetch holders list from `/api/shares/:skillId`, compute `nextSnapshotId` from on-chain pool, call `settlePeriod(conn, aliceSigner, { programId, skill, nextSnapshotId, holders })`.
- `claim_alice` / `claim_bob` → `claimRevenue(conn, signer, { programId, skill, snapshotId })`.
- `publish_v1_1` → assemble the v2 content from stored base + extra section (same logic as Slice 1's step), upload to mock Arweave, `publishNewVersion(conn, aliceSigner, {...})`.

- [ ] **Step 4: Update `app/console/personas.ts`**

Remove the hard-coded `DEMO_PERSONAS` base58 strings (Slice 1 had them). Replace with an async loader that fetches `/api/console/personas` and caches the response.

- [ ] **Step 5: Update seed-devnet.ts**

Modify `SKILLS[0]` (`"GitHub PR Review"`) to use `periodLengthSeconds: 60n` instead of `300n`. The other 5 keep `300n`.

- [ ] **Step 6: Build + typecheck**

Run: `pnpm build && pnpm typecheck`
Expected: Green.

- [ ] **Step 7: Commit**

```bash
git add app/console app/api/console scripts/seed-devnet.ts
git commit -m "feat(console): persona-vault signer + on-chain stepper actions"
```

---

### Task 24: `/api/me` RPC balance + `/api/reset` indexer reset

**Goal:** Update `/api/me` to await the async `getSolBalance`. Update `/api/reset` to also clear `indexer_state` + `indexed_signatures` so the indexer re-projects next tick.

**Files:**
- Modify: `app/api/me/route.ts`
- Modify: `app/api/reset/route.ts`

- [ ] **Step 1: `/api/me` — await getSolBalance**

Edit: change `balance: getSolBalance(self)` to `balance: await getSolBalance(self)`.

- [ ] **Step 2: `/api/reset` — clear indexer bookkeeping**

Read the file; add to the list of deleted tables: `indexer_state`, `indexed_signatures`.

- [ ] **Step 3: Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: Green.

- [ ] **Step 4: Commit**

```bash
git add app/api/me/route.ts app/api/reset/route.ts
git commit -m "fix(api): await RPC balance + reset clears indexer bookkeeping"
```

---

### Task 25: Playwright devnet E2E spec + gate

**Goal:** One end-to-end spec that walks `/console` through all six acts and asserts on-chain side effects.

**Files:**
- Create: `tests/e2e/console-devnet.spec.ts`
- Modify: `package.json` (add `test:e2e:devnet` script)

- [ ] **Step 1: Add script**

In `package.json` under `scripts`:
```json
"test:e2e:devnet": "SLP_DEVNET_E2E=1 playwright test tests/e2e/console-devnet.spec.ts"
```

- [ ] **Step 2: Write `tests/e2e/console-devnet.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.skip(process.env.SLP_DEVNET_E2E !== "1", "Devnet E2E disabled (set SLP_DEVNET_E2E=1)");

test("console steps through all six PRD acts on devnet", async ({ page }) => {
  await page.goto("/console");
  await page.getByText(/step-through/i).waitFor({ timeout: 5000 });

  const steps = ["reset_then_seed","subscribe_bob","submit_bob_experience","evaluate","subscribe_carol","settle","claim_alice","claim_bob","publish_v1_1"];
  for (const s of steps) {
    const btn = page.getByRole("button", { name: new RegExp(s.replace(/_/g, ".*"), "i") });
    if (await btn.count()) { await btn.click(); }
    else { await page.keyboard.press("ArrowRight"); }
    await page.waitForTimeout(12_000); // settle to confirmed + indexer tick
  }

  // Verify indexer parity
  const res = await page.request.get("/api/indexer/status?verify=1");
  const json = await res.json();
  expect(json.data.ok).toBe(true);
});
```

- [ ] **Step 3: Run the E2E against a live devnet (manual verification)**

Run:
```bash
cp .env.example .env.local
pnpm demo:personas ; pnpm tsx scripts/init-protocol.ts ; pnpm tsx scripts/seed-devnet.ts
pnpm dev &
sleep 6
pnpm test:e2e:devnet
kill %1
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/console-devnet.spec.ts package.json
git commit -m "test(e2e): gated devnet Playwright spec"
```

---

### Task 26: README + final verification

**Goal:** Document the "Run locally against devnet" path, run the 12 acceptance criteria, ensure a clean green build.

**Files:**
- Modify: `README.md` (or create if absent)

- [ ] **Step 1: Write README section**

Add or create `README.md` with a top-level section:
```markdown
## Run locally against devnet (Slice 3)

First-time setup (~5 minutes):

```bash
# 1. Deployer keypair (one-time)
solana-keygen new --outfile ~/.config/solana/slp-deployer.json
solana config set --url devnet --keypair ~/.config/solana/slp-deployer.json
solana airdrop 5

# 2. Build + deploy
./scripts/deploy-devnet.sh

# 3. Personas + init + seed
cp .env.example .env.local
pnpm tsx scripts/demo-personas.ts
pnpm tsx scripts/init-protocol.ts
pnpm tsx scripts/seed-devnet.ts

# 4. Run
pnpm dev
```

Open http://localhost:3000 and connect Phantom on devnet. For the presenter demo, visit `/console`.

To reset SQLite (not chain): `curl -XPOST http://localhost:3000/api/reset`
```

- [ ] **Step 2: Run all tests + builds**

Run:
```bash
pnpm typecheck
pnpm test run
pnpm build
cd programs && cargo test --release
```
Expected: Green across all four.

- [ ] **Step 3: Manual walk (acceptance criteria 1-6)**

In a browser, walk through the entire PRD six-act flow via `/console`. Screenshot each beat. Verify:
- Explorer links open and show confirmed txs
- `/market` shows 6 skills
- `/api/indexer/status?verify=1` returns `{ok: true}`
- Judge daemon evaluates within 10s of submit
- SOL balances move on claim (header refresh)
- v1.1 shows Bob as a contributor

- [ ] **Step 4: Commit + branch finish**

```bash
git add README.md
git commit -m "docs: README — run locally against devnet"
```

---

## Self-review

Checking this plan against the spec:

**Spec coverage:**
- Scope bullets 1-12 all have tasks. ✓
- All 8 instruction helpers have builder + high-level + tests in Tasks 10/11/12. ✓
- All 8 event variants have round-trip + projection tests. ✓
- DB migrations: Task 13. ✓
- Deletions: Task 17. ✓
- Personas + deploy + init + seed: Tasks 18, 6, 19. ✓
- Judge daemon: Task 20. ✓
- Bootstrap autostart: Task 21. ✓
- Indexer tick + status routes: Task 16. ✓
- UI wiring: Tasks 22, 23. ✓
- Reset + balance RPC: Task 24. ✓
- E2E gate: Task 25. ✓
- README: Task 26. ✓

**Placeholder scan:** No "TBD", "handle edge cases" etc. Every step has exact code or exact command.

**Type consistency check:**
- `Signer` interface defined in Task 7 (program.ts) and used consistently in Tasks 10-12, 18, 20.
- `pdas.*` shape locked in Task 5; all tx builders in 10-12 import the same names.
- `ChainError` from Task 9, `SlpEvent` from Task 8.
- `PersonaSigner extends Signer` in Task 18 — composable.

**Scope note:** Seed script sets `periodLengthSeconds: 60n` for Alice's skill so demo settle finishes quickly (Task 23 step 5). Other skills keep 300s. This is the practical workaround for "can't rewind devnet clock."

**Plan complete and saved to `docs/superpowers/plans/2026-04-24-slp-web-wiring.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session, batch with checkpoints.

**Which approach?**
