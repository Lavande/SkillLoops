#!/usr/bin/env tsx
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
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
    console.log(`[personas] ${kp.publicKey.toBase58()} has ${bal / LAMPORTS_PER_SOL} SOL — skipping airdrop`);
    return;
  }
  const need = TARGET_LAMPORTS - bal;
  const sig = await conn.requestAirdrop(kp.publicKey, need);
  await conn.confirmTransaction(sig, "confirmed");
  console.log(`[personas] airdropped ${need / LAMPORTS_PER_SOL} SOL to ${kp.publicKey.toBase58()}`);
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
