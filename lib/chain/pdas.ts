import { PublicKey } from "@solana/web3.js";
import { createHash } from "node:crypto";

function u32le(n: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b; }
function u64le(n: bigint): Buffer { const b = Buffer.alloc(8); b.writeBigUInt64LE(n, 0); return b; }

function nameHash(name: string): Buffer {
  return createHash("sha256").update(name).digest().subarray(0, 16);
}

export const pdas = {
  nameHash,

  config(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([Buffer.from("config")], programId);
  },

  skill(programId: PublicKey, author: PublicKey, name: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), author.toBuffer(), nameHash(name)], programId);
  },

  skillVersion(programId: PublicKey, skill: PublicKey, version: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("version"), skill.toBuffer(), u32le(version)], programId);
  },

  shareLedger(programId: PublicKey, skill: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("ledger"), skill.toBuffer()], programId);
  },

  revenuePool(programId: PublicKey, skill: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), skill.toBuffer()], programId);
  },

  shareAccount(programId: PublicKey, skill: PublicKey, holder: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("share"), skill.toBuffer(), holder.toBuffer()], programId);
  },

  subscription(programId: PublicKey, skill: PublicKey, subscriber: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("sub"), skill.toBuffer(), subscriber.toBuffer()], programId);
  },

  experience(programId: PublicKey, skill: PublicKey, experienceId: bigint): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("exp"), skill.toBuffer(), u64le(experienceId)], programId);
  },

  claimable(programId: PublicKey, skill: PublicKey, holder: PublicKey, snapshotId: bigint): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), skill.toBuffer(), holder.toBuffer(), u64le(snapshotId)], programId);
  },
};
