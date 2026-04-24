import {
  Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction, Keypair,
} from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { createHash } from "node:crypto";
import { getProgram, type Signer } from "./program";
import { pdas } from "./pdas";
import { parseChainError } from "./errors";

export interface TxResult { sig: string }

// ---- Shared send helper ----

export async function sendAndIndex(
  connection: Connection,
  signer: Signer,
  instructions: TransactionInstruction[],
  extraSigners: Keypair[] = [],
  { pokeIndexer = true }: { pokeIndexer?: boolean } = {},
): Promise<TxResult> {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: signer.publicKey, blockhash, lastValidBlockHeight });
  tx.add(...instructions);
  extraSigners.forEach((kp) => tx.partialSign(kp));
  let signed: Transaction;
  try {
    signed = await signer.signTransaction(tx);
  } catch (e) {
    throw parseChainError(e);
  }
  let sig: string;
  try {
    sig = await connection.sendRawTransaction(signed.serialize(), { skipPreflight: false });
  } catch (e) {
    throw parseChainError(e);
  }
  try {
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed",
    );
  } catch (e) {
    throw parseChainError(e, sig);
  }
  if (pokeIndexer && typeof fetch !== "undefined") {
    try {
      await fetch("/api/indexer/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sig }),
      });
    } catch {
      // Indexer will catch up on its own; tx is already confirmed.
    }
  }
  return { sig };
}

// ---- Instruction builders ----

export async function buildInitializeProtocolIx(args: {
  programId: PublicKey; admin: PublicKey; judge: PublicKey;
}): Promise<TransactionInstruction> {
  const { programId, admin, judge } = args;
  const [config] = pdas.config(programId);
  const program = getProgram(
    { rpcEndpoint: "" } as unknown as Connection,
    { publicKey: admin, signTransaction: async (t: any) => t },
    programId,
  );
  return await program.methods
    .initializeProtocol(judge)
    .accountsPartial({ admin, config, systemProgram: SystemProgram.programId })
    .instruction();
}

export async function buildPublishSkillIx(args: {
  programId: PublicKey; author: PublicKey;
  name: string; description: string; category: string;
  contentHash: Uint8Array; arweaveTxId: string;
  subscriptionPriceLamports: bigint;
  minAuthorRatioBps: number; k: number; periodLengthSeconds: bigint;
}): Promise<TransactionInstruction> {
  const { programId, author } = args;
  const [skill] = pdas.skill(programId, author, args.name);
  const [version] = pdas.skillVersion(programId, skill, 1);
  const [ledger] = pdas.shareLedger(programId, skill);
  const [pool] = pdas.revenuePool(programId, skill);
  const [authorShare] = pdas.shareAccount(programId, skill, author);
  const nameHash = pdas.nameHash(args.name);

  const program = getProgram(
    { rpcEndpoint: "" } as unknown as Connection,
    { publicKey: author, signTransaction: async (t: any) => t },
    programId,
  );
  return await program.methods
    .publishSkill({
      name: args.name,
      description: args.description,
      category: args.category,
      contentHash: Array.from(args.contentHash),
      arweaveTxId: args.arweaveTxId,
      subscriptionPrice: new BN(args.subscriptionPriceLamports.toString()),
      minAuthorRatioBps: args.minAuthorRatioBps,
      k: args.k,
      periodLength: new BN(args.periodLengthSeconds.toString()),
      nameHash: Array.from(nameHash),
    })
    .accountsPartial({
      author,
      skill,
      version,
      ledger,
      pool,
      authorShare,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

// ---- High-level helpers ----

export async function initializeProtocol(
  connection: Connection,
  signer: Signer,
  judge: PublicKey,
  programId: PublicKey,
): Promise<TxResult> {
  const ix = await buildInitializeProtocolIx({ programId, admin: signer.publicKey, judge });
  return sendAndIndex(connection, signer, [ix], [], { pokeIndexer: false });
}

export async function publishSkill(
  connection: Connection,
  signer: Signer,
  args: {
    programId: PublicKey;
    name: string; description: string; category: string;
    content: string; arweaveTxId: string;
    subscriptionPriceLamports: bigint;
    minAuthorRatioBps: number; k: number; periodLengthSeconds: bigint;
  },
): Promise<TxResult & { skillId: string }> {
  const contentHash = createHash("sha256").update(args.content).digest();
  const ix = await buildPublishSkillIx({
    programId: args.programId,
    author: signer.publicKey,
    name: args.name,
    description: args.description,
    category: args.category,
    contentHash: new Uint8Array(contentHash),
    arweaveTxId: args.arweaveTxId,
    subscriptionPriceLamports: args.subscriptionPriceLamports,
    minAuthorRatioBps: args.minAuthorRatioBps,
    k: args.k,
    periodLengthSeconds: args.periodLengthSeconds,
  });
  const [skill] = pdas.skill(args.programId, signer.publicKey, args.name);
  const res = await sendAndIndex(connection, signer, [ix]);
  return { ...res, skillId: skill.toBase58() };
}

export async function buildSubscribeIx(args: {
  programId: PublicKey; subscriber: PublicKey; skill: PublicKey;
}): Promise<TransactionInstruction> {
  const [pool] = pdas.revenuePool(args.programId, args.skill);
  const [subscription] = pdas.subscription(args.programId, args.skill, args.subscriber);
  const [shareAccount] = pdas.shareAccount(args.programId, args.skill, args.subscriber);
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: args.subscriber, signTransaction: async (t: any) => t,
  }, args.programId);
  return await program.methods
    .subscribe()
    .accountsPartial({
      subscriber: args.subscriber,
      skill: args.skill,
      pool, subscription, shareAccount,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function subscribe(
  connection: Connection, signer: Signer, programId: PublicKey, skill: PublicKey,
): Promise<TxResult> {
  const ix = await buildSubscribeIx({ programId, subscriber: signer.publicKey, skill });
  return sendAndIndex(connection, signer, [ix]);
}

export async function buildSubmitExperienceIx(args: {
  programId: PublicKey; contributor: PublicKey; skill: PublicKey;
  nextExperienceId: bigint; contentHash: Uint8Array; arweaveTxId: string; skillVersion: number;
}): Promise<TransactionInstruction> {
  const [experience] = pdas.experience(args.programId, args.skill, args.nextExperienceId);
  const [contributorShare] = pdas.shareAccount(args.programId, args.skill, args.contributor);
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: args.contributor, signTransaction: async (t: any) => t,
  }, args.programId);
  return await program.methods
    .submitExperience({
      contentHash: Array.from(args.contentHash),
      arweaveTxId: args.arweaveTxId,
      skillVersion: args.skillVersion,
    })
    .accountsPartial({
      contributor: args.contributor,
      skill: args.skill,
      experience,
      contributorShare,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function submitExperience(
  connection: Connection, signer: Signer, args: {
    programId: PublicKey; skill: PublicKey; nextExperienceId: bigint;
    contentHash: Uint8Array; arweaveTxId: string; skillVersion: number;
  }
): Promise<TxResult & { experienceId: string }> {
  const ix = await buildSubmitExperienceIx({
    programId: args.programId, contributor: signer.publicKey,
    skill: args.skill, nextExperienceId: args.nextExperienceId,
    contentHash: args.contentHash, arweaveTxId: args.arweaveTxId,
    skillVersion: args.skillVersion,
  });
  const [exp] = pdas.experience(args.programId, args.skill, args.nextExperienceId);
  const res = await sendAndIndex(connection, signer, [ix]);
  return { ...res, experienceId: exp.toBase58() };
}

export async function buildEvaluateExperienceIx(args: {
  programId: PublicKey; judge: PublicKey;
  skill: PublicKey; experienceId: bigint; contributor: PublicKey;
  score: number; judgeReportTxId: string;
}): Promise<TransactionInstruction> {
  const [config] = pdas.config(args.programId);
  const [experience] = pdas.experience(args.programId, args.skill, args.experienceId);
  const [ledger] = pdas.shareLedger(args.programId, args.skill);
  const [contributorShare] = pdas.shareAccount(args.programId, args.skill, args.contributor);
  const program = getProgram({ rpcEndpoint: "" } as unknown as Connection, {
    publicKey: args.judge, signTransaction: async (t: any) => t,
  }, args.programId);
  return await program.methods
    .evaluateExperience(args.score, args.judgeReportTxId)
    .accountsPartial({
      judge: args.judge, config,
      skill: args.skill, experience,
      ledger, contributorShare,
    })
    .instruction();
}

export async function evaluateExperience(
  connection: Connection, signer: Signer, args: {
    programId: PublicKey; skill: PublicKey; experienceId: bigint;
    contributor: PublicKey; score: number; judgeReportTxId: string;
  }
): Promise<TxResult> {
  const ix = await buildEvaluateExperienceIx({
    programId: args.programId, judge: signer.publicKey,
    skill: args.skill, experienceId: args.experienceId,
    contributor: args.contributor, score: args.score,
    judgeReportTxId: args.judgeReportTxId,
  });
  return sendAndIndex(connection, signer, [ix]);
}
