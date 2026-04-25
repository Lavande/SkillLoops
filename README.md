# SkillLoops — SLP

Decentralized marketplace for executable AI Skills with shared revenue and on-chain provenance. Author-side incentives, contributor-side share minting, and AI-judge-evaluated experience submissions, all settled on Solana.

- `programs/slp/` — Anchor program (Solana, devnet).
- `app/`, `lib/`, `components/` — Next.js 14 app + chain client + indexer.
- `scripts/` — devnet deploy + persona vault + protocol/init seeders.

## Run locally against devnet (Slice 3)

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

### Devnet E2E

Gated behind `SLP_DEVNET_E2E=1`:

```bash
pnpm test:e2e:devnet
```

Walks `/console` through all six PRD acts and asserts that the indexer's projection matches on-chain state.

## Slice 4 real Irys + Judge opt-in

The default local demo still uses mock storage and the deterministic mock judge.
To use real Irys storage and Anthropic scoring:

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
