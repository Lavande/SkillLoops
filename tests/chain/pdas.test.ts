import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "node:crypto";
import { pdas } from "@/lib/chain/pdas";

const PROGRAM = new PublicKey("BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t");
const AUTHOR = new PublicKey("11111111111111111111111111111112");
const HOLDER = new PublicKey("11111111111111111111111111111113");
const SKILL = new PublicKey("11111111111111111111111111111114");

describe("PDA derivations", () => {
  it("config uses seed b'config'", () => {
    const [expected] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM);
    expect(pdas.config(PROGRAM)[0].equals(expected)).toBe(true);
  });

  it("skill uses [b'skill', author, sha256(name)[..16]]", () => {
    const nameHash = createHash("sha256").update("Alice Skill").digest().subarray(0, 16);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("skill"), AUTHOR.toBuffer(), nameHash],
      PROGRAM,
    );
    expect(pdas.skill(PROGRAM, AUTHOR, "Alice Skill")[0].equals(expected)).toBe(true);
  });

  it("version uses [b'version', skill, u32 le]", () => {
    const ver = Buffer.alloc(4); ver.writeUInt32LE(5, 0);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("version"), SKILL.toBuffer(), ver], PROGRAM);
    expect(pdas.skillVersion(PROGRAM, SKILL, 5)[0].equals(expected)).toBe(true);
  });

  it("ledger uses [b'ledger', skill]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("ledger"), SKILL.toBuffer()], PROGRAM);
    expect(pdas.shareLedger(PROGRAM, SKILL)[0].equals(expected)).toBe(true);
  });

  it("pool uses [b'pool', skill]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool"), SKILL.toBuffer()], PROGRAM);
    expect(pdas.revenuePool(PROGRAM, SKILL)[0].equals(expected)).toBe(true);
  });

  it("share account uses [b'share', skill, holder]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("share"), SKILL.toBuffer(), HOLDER.toBuffer()], PROGRAM);
    expect(pdas.shareAccount(PROGRAM, SKILL, HOLDER)[0].equals(expected)).toBe(true);
  });

  it("subscription uses [b'sub', skill, subscriber]", () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("sub"), SKILL.toBuffer(), HOLDER.toBuffer()], PROGRAM);
    expect(pdas.subscription(PROGRAM, SKILL, HOLDER)[0].equals(expected)).toBe(true);
  });

  it("experience uses [b'exp', skill, u64 le]", () => {
    const idBuf = Buffer.alloc(8); idBuf.writeBigUInt64LE(42n, 0);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("exp"), SKILL.toBuffer(), idBuf], PROGRAM);
    expect(pdas.experience(PROGRAM, SKILL, 42n)[0].equals(expected)).toBe(true);
  });

  it("experience derivation does not require Buffer writeBigUInt64LE at runtime", () => {
    const idBuf = Buffer.alloc(8); idBuf.writeBigUInt64LE(42n, 0);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("exp"), SKILL.toBuffer(), idBuf], PROGRAM);
    const original = Buffer.prototype.writeBigUInt64LE;
    try {
      (Buffer.prototype as any).writeBigUInt64LE = undefined;
      expect(pdas.experience(PROGRAM, SKILL, 42n)[0].equals(expected)).toBe(true);
    } finally {
      Buffer.prototype.writeBigUInt64LE = original;
    }
  });

  it("claim uses [b'claim', skill, holder, snapshot_id u64 le]", () => {
    const snap = Buffer.alloc(8); snap.writeBigUInt64LE(7n, 0);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), SKILL.toBuffer(), HOLDER.toBuffer(), snap], PROGRAM);
    expect(pdas.claimable(PROGRAM, SKILL, HOLDER, 7n)[0].equals(expected)).toBe(true);
  });

  it("nameHash matches sha256(name)[..16]", () => {
    const { nameHash } = pdas;
    expect(Buffer.from(nameHash("Alice Skill")).toString("hex")).toBe(
      createHash("sha256").update("Alice Skill").digest().subarray(0, 16).toString("hex")
    );
  });
});
