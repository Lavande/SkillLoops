import { describe, it, expect } from "vitest";
import { PublicKey, Keypair } from "@solana/web3.js";
import { buildInitializeProtocolIx, buildPublishSkillIx } from "@/lib/chain/tx";

describe("tx builders — initialize + publish", () => {
  const programId = new PublicKey("BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t");
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
