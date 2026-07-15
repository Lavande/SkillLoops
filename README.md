# Skill Loops Protocol (SLP)

> **Decentralized marketplace for executable AI Skills with shared revenue and on-chain provenance.**
> **A Solana-based protocol where every buyer of an AI agent skill can earn ownership by contributing useful usage experience. Ownership percentages share the skill's future revenue.**

The core metaphor is the **Skill Loop**: a skill is used by an agent, the agent reflects on its experience, that experience feeds back into the skill, the skill evolves, and the loop continues forever.

---

## 🌟 The Problem & Key Innovations

### The Problem
1. **Skills decay after sale.** Environments drift, new edge cases emerge, LLMs update, and APIs break. A skill sold in month 1 is often half-broken by month 6. Sellers have no systematic way to keep improving it.
2. **The most valuable signal is wasted.** When an agent fails while using a skill, the failure trace is the single most valuable data point for improving the skill. Today, this signal is thrown away.
3. **Buyer and seller interests diverge after purchase.** Once the transaction closes, the buyer has no stake in the skill's future. The relationship is zero-sum.

### Key Innovations
- **Buying starts at 0% ownership.** Every subscriber gets a share account at purchase. If they never contribute, they stay at 0 — it's just a subscription. Useful experience can grow their ownership percentage.
- **Ownership is derived from contribution weight.** The author is never involuntarily diluted below a floor they set, and early contributions are damped so one large first submission cannot crush the author to the floor.
- **AI judges evaluate AI contributions to AI skills.** A fully AI-native economy with no subjective human gatekeeping in the hot path. Author-side incentives, contributor-side ownership changes, and AI-judge-evaluated experience submissions are all settled on Solana.
- **The client is a skill.** Instead of shipping an SDK, the protocol's reflection logic is itself packaged as a `SKILL.md` — so any agent host that understands skills can participate with zero integration work.

## 🏗️ Architecture & Tech Stack

- **Smart Contracts**: Anchor (Rust) on Solana Devnet (5 core programs).
- **Frontend**: Next.js 14 App Router, Tailwind CSS, shadcn/ui.
- **Permanent Storage**: Irys → Arweave (Solana-native pay).
- **Content Gating**: Lit Protocol (Access-controlled decryption).
- **AI Judge**: Anthropic Claude API.
- **Wallet**: Solana Wallet Adapter (Phantom / Backpack).

## 📂 Repository Structure

- `programs/slp/` — Core Anchor program (Solana, devnet). Contains all on-chain logic (`math.rs`, instructions, state).
- `app/`, `lib/`, `components/` — Next.js 14 app + chain client + indexer.
- `scripts/` — Scripts for devnet deployment, persona vault initialization, and protocol/skill seeders.
- `docs/` — PRD and detailed system design specifications.
- `tests/` — End-to-end tests (Playwright) and Vitest configs.

## 🚀 Getting Started

### Run locally against devnet (Slice 3)

First-time setup (~5 minutes):

```bash
# 1. Deployer keypair (one-time)
solana-keygen new --outfile ~/.config/solana/slp-deployer.json
solana config set --url devnet --keypair ~/.config/solana/slp-deployer.json
solana airdrop 5

# 2. Build + deploy the Anchor program (writes the IDL into lib/chain/)
./scripts/deploy-devnet.sh

# 3. Personas + protocol init + on-chain skill seed
cp .env.example .env.local
pnpm install
pnpm tsx scripts/demo-personas.ts
pnpm tsx scripts/init-protocol.ts
pnpm tsx scripts/seed-devnet.ts

# 4. Run the dapp
pnpm dev
```

Open <http://localhost:3000> and connect Phantom on devnet. For the presenter demo, visit `/console` — the stepper unlocks the persona vault on mount and signs each act client-side.

To reset the SQLite indexer (does NOT touch chain):

```bash
curl -XPOST http://localhost:3000/api/reset
```

The indexer will re-project from the program's earliest signature on the next tick.

## 🧪 Testing

### Devnet E2E

Gated behind `SLP_DEVNET_E2E=1`:

```bash
pnpm test:e2e:devnet
```

Walks `/console` through all six PRD acts and asserts that the indexer's projection matches on-chain state.

### Local Unit Testing
```bash
pnpm test
```

## ⚙️ Advanced Configurations

### Slice 4: Real Irys + AI Judge Opt-in

The default local demo still uses mock storage and the deterministic mock judge.
To use real Irys storage and Anthropic scoring:

```bash
pnpm add @irys/upload @irys/upload-solana
```

Then set in `.env.local`:

```env
STORAGE_BACKEND=irys
IRYS_PRIVATE_KEY=<solana-private-key-or-secret-json>
IRYS_GATEWAY_URL=https://gateway.irys.xyz
IRYS_NETWORK=devnet

JUDGE_BACKEND=anthropic
JUDGE_DAEMON_AUTOSTART=true
JUDGE_PRIVATE_KEY_BASE64=<base64-encoded-64-byte-solana-secret>
ANTHROPIC_API_KEY=<key>
ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```

`JUDGE_PRIVATE_KEY_BASE64` is server-only. Store it in the deployment platform's
secret manager; never expose it through a `NEXT_PUBLIC_` variable. Local demos
without this variable continue to use the judge entry in `DEMO_PERSONAS_PATH`.

*Lit decrypt remains mocked in this slice.*

### Slice 5: Browser Lit + Irys Opt-in

Default local behavior still uses the API upload path and mock Lit envelope:

```env
NEXT_PUBLIC_STORAGE_MODE=api
NEXT_PUBLIC_LIT_MODE=mock
NEXT_PUBLIC_LIT_NETWORK=datil-dev
```

To test browser wallet-backed Irys uploads and Lit encryption/decryption:

```env
NEXT_PUBLIC_STORAGE_MODE=browser-irys
NEXT_PUBLIC_LIT_MODE=real
NEXT_PUBLIC_LIT_NETWORK=datil-dev
```

In real mode, `/publish` encrypts `SKILL.md` content before browser Irys upload,
`/submit` uploads `ExperienceBundle` JSON through browser Irys, and `/skill/[id]`
decrypts fetched skill content through Lit. `/console` intentionally remains on
the deterministic mock/API path.
