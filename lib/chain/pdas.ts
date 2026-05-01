import { PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha2.js";

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function u32le(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

function u64le(n: bigint): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return b;
}

function nameHash(name: string): Uint8Array {
  return sha256(new TextEncoder().encode(name)).subarray(0, 16);
}

export const pdas = {
  nameHash,

  config(programId: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync([bytes("config")], programId);
  },

  skill(programId: PublicKey, author: PublicKey, name: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [bytes("skill"), author.toBuffer(), nameHash(name)], programId);
  },

  skillVersion(programId: PublicKey, skill: PublicKey, version: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [bytes("version"), skill.toBuffer(), u32le(version)], programId);
  },

  shareLedger(programId: PublicKey, skill: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [bytes("ledger"), skill.toBuffer()], programId);
  },

  revenuePool(programId: PublicKey, skill: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [bytes("pool"), skill.toBuffer()], programId);
  },

  shareAccount(programId: PublicKey, skill: PublicKey, holder: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [bytes("share"), skill.toBuffer(), holder.toBuffer()], programId);
  },

  subscription(programId: PublicKey, skill: PublicKey, subscriber: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [bytes("sub"), skill.toBuffer(), subscriber.toBuffer()], programId);
  },

  experience(programId: PublicKey, skill: PublicKey, experienceId: bigint): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [bytes("exp"), skill.toBuffer(), u64le(experienceId)], programId);
  },

  claimable(programId: PublicKey, skill: PublicKey, holder: PublicKey, snapshotId: bigint): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [bytes("claim"), skill.toBuffer(), holder.toBuffer(), u64le(snapshotId)], programId);
  },
};
