#!/usr/bin/env bash
set -euo pipefail

# Deploys the slp Anchor program to Solana devnet and copies the generated
# IDL + TypeScript types into lib/chain/ for the Next.js app to import.
#
# Usage (from repo root):
#   ./scripts/deploy-devnet.sh

DEPLOYER_KEYPAIR="${DEPLOYER_KEYPAIR:-$HOME/.config/solana/slp-deployer.json}"
PROGRAM_KEYPAIR="${PROGRAM_KEYPAIR:-./programs/target/deploy/slp-keypair.json}"

if [ ! -f "$DEPLOYER_KEYPAIR" ]; then
  echo "Missing deployer keypair at $DEPLOYER_KEYPAIR"
  echo "Run: solana-keygen new --outfile $DEPLOYER_KEYPAIR"
  exit 1
fi

# The build toolchain for Slice 2 pinned solana-cli 2.2.20 + platform-tools v1.54.
# We prefer those if available so the .so matches what Slice 2 tested.
if [ -d "$HOME/.local/share/solana/install/releases/2.2.20/solana-release/bin" ]; then
  export PATH="$HOME/.local/share/solana/install/releases/2.2.20/solana-release/bin:$PATH"
fi

# Add local node_modules to PATH so Anchor can find prettier for IDL generation
export PATH="$(pwd)/node_modules/.bin:$PATH"

# --- 1. Build the on-chain program (.so + keypair) ---
# `anchor build` silently no-ops in this repo layout because Anchor.toml lives
# under programs/ (not at workspace root), so we invoke cargo-build-sbf directly.
# --tools-version v1.54 pulls in rustc 1.89 which the Anchor 0.31.1 deps need.
echo ">>> cargo-build-sbf --tools-version v1.54"
( cd programs && cargo-build-sbf --tools-version v1.54 )

# --- 2. Build the IDL + TypeScript types ---
# Anchor needs an "Anchor workspace" layout (Anchor.toml at workspace root with
# programs at programs/<name>/). We build a transient mirror layout under
# programs/.anchor-ws/ that symlinks back to the real sources.
ANCHOR_WS="programs/.anchor-ws"
rm -rf "$ANCHOR_WS"
mkdir -p "$ANCHOR_WS/programs"
ln -s "$(pwd)/programs/slp" "$ANCHOR_WS/programs/slp"
ln -s "$(pwd)/programs/target" "$ANCHOR_WS/target"
ln -s "$(pwd)/programs/rust-toolchain.toml" "$ANCHOR_WS/rust-toolchain.toml"
ln -s "$(pwd)/programs/Xargo.toml" "$ANCHOR_WS/Xargo.toml"

cat > "$ANCHOR_WS/Cargo.toml" <<'EOF'
[workspace]
resolver = "2"
members = ["programs/slp"]

[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1

[profile.release.build-override]
opt-level = 3
incremental = false
codegen-units = 1
EOF

# Anchor.toml for the transient workspace — same [programs.*] as programs/Anchor.toml.
cp programs/Anchor.toml "$ANCHOR_WS/Anchor.toml"

echo ">>> anchor idl build"
mkdir -p "$ANCHOR_WS/target/idl" "$ANCHOR_WS/target/types"
( cd "$ANCHOR_WS" && anchor idl build -o target/idl/slp.json -t target/types/slp.ts )

# --- 3. Copy IDL + types into lib/chain/ ---
mkdir -p lib/chain
cp programs/target/idl/slp.json lib/chain/idl-slp.json
cp programs/target/types/slp.ts lib/chain/slp.ts
echo ">>> copied IDL + types into lib/chain/"

# --- 4. Deploy to devnet ---
echo ">>> solana program deploy"
solana program deploy \
  --url devnet \
  --keypair "$DEPLOYER_KEYPAIR" \
  --program-id "$PROGRAM_KEYPAIR" \
  programs/target/deploy/slp.so

# --- 5. Cleanup transient workspace ---
rm -rf "$ANCHOR_WS"

echo ""
echo "Deployed. Program: $(solana address -k "$PROGRAM_KEYPAIR")"
echo "Next: pnpm tsx scripts/init-protocol.ts"
