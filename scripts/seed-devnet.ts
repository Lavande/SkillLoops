#!/usr/bin/env tsx
import dotenv from "dotenv";
dotenv.config();
dotenv.config({ path: ".env.local", override: true });
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { ArweaveMock } from "../lib/mock/arweave";
import { getConnection } from "../lib/chain/connection";
import { getChainConfig } from "../lib/chain/config";
import { publishSkill } from "../lib/chain/tx";
import { loadPersonaSigners } from "../lib/personas";
import { K_DEFAULT } from "../lib/domain/thresholds";

const SKILLS = [
  { name: "GitHub PR Review", desc: "Reviews PRs for tests, style, security, safety.", cat: "coding", price: 0.1, floor: 4000, periodLengthSeconds: 60n },
  { name: "SQL Query Reviewer", desc: "Catches N+1s, missing indexes, lock contention.", cat: "coding", price: 0.05, floor: 4500, periodLengthSeconds: 300n },
  { name: "Regex Debugger", desc: "Explains a regex, finds backtracking pitfalls.", cat: "coding", price: 0.02, floor: 3500, periodLengthSeconds: 300n },
  { name: "K8s YAML Linter", desc: "Checks resource limits, liveness probes, IAM.", cat: "devops", price: 0.08, floor: 4200, periodLengthSeconds: 300n },
  { name: "Meeting Notes Distiller", desc: "Turns a transcript into decisions + action items.", cat: "productivity", price: 0.03, floor: 4000, periodLengthSeconds: 300n },
  { name: "Copy Brand Voice Match", desc: "Rewrites marketing copy in a target voice.", cat: "writing", price: 0.04, floor: 4300, periodLengthSeconds: 300n },
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
        minAuthorRatioBps: s.floor, k: K_DEFAULT, periodLengthSeconds: s.periodLengthSeconds,
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
