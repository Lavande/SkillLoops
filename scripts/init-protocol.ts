#!/usr/bin/env tsx
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { Keypair } from "@solana/web3.js";
import fs from "node:fs";
import { getConnection } from "../lib/chain/connection";
import { getChainConfig } from "../lib/chain/config";
import { initializeProtocol } from "../lib/chain/tx";
import { pdas } from "../lib/chain/pdas";
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

  const [configPda] = pdas.config(programId);
  const info = await conn.getAccountInfo(configPda);
  if (info) { console.log("[init] ProtocolConfig already exists — skipping"); return; }

  const { sig } = await initializeProtocol(conn, deployerSigner, judgePk, programId);
  console.log("[init] initialized — sig:", sig);
}

main().catch((e) => {
  console.error("Initialization failed:");
  console.error(e);
  process.exit(1);
});
