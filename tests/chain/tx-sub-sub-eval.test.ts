import { describe, it, expect } from "vitest";
import { PublicKey, Keypair, SystemProgram, Transaction, type VersionedTransaction } from "@solana/web3.js";
import bs58 from "bs58";
import {
  buildSubscribeIx, buildSubmitExperienceIx, buildEvaluateExperienceIx, sendAndIndex,
} from "@/lib/chain/tx";
import type { Signer } from "@/lib/chain/program";

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

  it("treats an already-processed signed transaction as successful", async () => {
    const payer = Keypair.generate();
    let observedSig = "";
    const connection = {
      getLatestBlockhash: async () => ({
        blockhash: "11111111111111111111111111111111",
        lastValidBlockHeight: 123,
      }),
      sendRawTransaction: async (raw: Buffer | Uint8Array) => {
        const tx = Transaction.from(raw);
        observedSig = bs58.encode(tx.signature!);
        throw new Error("Transaction simulation failed: This transaction has already been processed.");
      },
      confirmTransaction: async () => ({ value: { err: null } }),
    } as any;
    const signer: Signer = {
      publicKey: payer.publicKey,
      signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
        if (tx instanceof Transaction) tx.partialSign(payer);
        return tx;
      },
    };
    const ix = SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: Keypair.generate().publicKey,
      lamports: 1,
    });

    const result = await sendAndIndex(connection, signer, [ix], [], { pokeIndexer: false });

    expect(result.sig).toBe(observedSig);
    expect(result.sig.length).toBeGreaterThan(0);
  });
});
