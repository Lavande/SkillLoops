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
