import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import { loadJudgeSigner } from "@/lib/personas";

describe("judge signer configuration", () => {
  it("loads a dedicated server-side signer from base64", () => {
    const keypair = Keypair.generate();
    const signer = loadJudgeSigner({
      JUDGE_PRIVATE_KEY_BASE64: Buffer.from(keypair.secretKey).toString("base64"),
    });

    expect(signer?.name).toBe("judge");
    expect(signer?.publicKey.toBase58()).toBe(keypair.publicKey.toBase58());
  });

  it("rejects malformed secret key material", () => {
    expect(() => loadJudgeSigner({
      JUDGE_PRIVATE_KEY_BASE64: Buffer.alloc(32).toString("base64"),
    })).toThrow("judge_private_key_base64_invalid");
  });
});
