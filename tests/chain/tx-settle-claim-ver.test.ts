import { describe, it, expect } from "vitest";
import { PublicKey, Keypair } from "@solana/web3.js";
import {
  buildSettlePeriodIx, buildClaimRevenueIx, buildPublishNewVersionIx,
} from "@/lib/chain/tx";

describe("tx builders — settle/claim/publishVersion", () => {
  const programId = new PublicKey("BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t");
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
