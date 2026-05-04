import { describe, expect, it, vi } from "vitest";
import {
  decryptSkillContent,
  encryptSkillContent,
  getLitMode,
  parseEncryptedSkillPayload,
} from "@/lib/lit/client";

const skillId = "7q6akTn3VYDoJjZ6Z8VFZrqmTuY7zj4KkT8hC8Q7DAoY";
const author = "4oP88QmGg3TQeNYK8VfLR8EAwV96AcNmQMiYhDMnSCPu";
const programId = "BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t";

describe("getLitMode", () => {
  it("defaults to mock mode", () => {
    expect(getLitMode({})).toBe("mock");
  });

  it("selects real mode from public env", () => {
    expect(getLitMode({ NEXT_PUBLIC_LIT_MODE: "real" })).toBe("real");
  });
});

describe("mock Lit mode", () => {
  it("preserves the existing LitMock envelope", async () => {
    const encrypted = await encryptSkillContent({
      plaintext: "# Skill",
      skillId,
      author,
      wallet: {},
    }, {
      env: { NEXT_PUBLIC_LIT_MODE: "mock" },
      chainConfig: { programId, cluster: "devnet" },
    });

    expect(encrypted.encrypted).toBe(false);
    expect(encrypted.content).toMatch(new RegExp(`^enc::${skillId}::`));
  });
});

describe("real Lit mode", () => {
  it("encrypts into an slp-lit-v1 JSON payload", async () => {
    const importImpl = vi.fn(async (specifier: string) => {
      if (specifier === "@lit-protocol/encryption") {
        return {
          encryptString: vi.fn(async () => ({
            ciphertext: "ciphertext-1",
            dataToEncryptHash: "hash-1",
          })),
        };
      }
      throw new Error(`unexpected import ${specifier}`);
    });

    const encrypted = await encryptSkillContent({
      plaintext: "# Skill",
      skillId,
      author,
      wallet: {},
    }, {
      env: { NEXT_PUBLIC_LIT_MODE: "real", NEXT_PUBLIC_LIT_NETWORK: "datil-dev" },
      chainConfig: { programId, cluster: "devnet" },
      importImpl,
      authSig: { sig: "sig" },
    });

    expect(encrypted.encrypted).toBe(true);
    const payload = parseEncryptedSkillPayload(encrypted.content);
    expect(payload.kind).toBe("slp-lit-v1");
    expect(payload.ciphertext).toBe("ciphertext-1");
    expect(payload.dataToEncryptHash).toBe("hash-1");
    expect(payload.litNetwork).toBe("datil-dev");
    expect(payload.solRpcConditions).toHaveLength(3);
  });

  it("rejects malformed decrypt payloads before importing Lit", async () => {
    const importImpl = vi.fn();

    await expect(decryptSkillContent({
      content: "not-json",
      skillId,
      wallet: {},
      caller: author,
    }, {
      env: { NEXT_PUBLIC_LIT_MODE: "real" },
      chainConfig: { programId, cluster: "devnet" },
      importImpl,
    })).rejects.toThrow(/lit_payload_invalid/);
    expect(importImpl).not.toHaveBeenCalled();
  });

  it("decrypts a valid payload through injected Lit decrypt", async () => {
    const importImpl = vi.fn(async (specifier: string) => {
      if (specifier === "@lit-protocol/encryption") {
        return { decryptToString: vi.fn(async () => "# Decrypted") };
      }
      throw new Error(`unexpected import ${specifier}`);
    });
    const payload = JSON.stringify({
      kind: "slp-lit-v1",
      ciphertext: "ciphertext-1",
      dataToEncryptHash: "hash-1",
      solRpcConditions: [{ method: "", params: [":userAddress"] }],
      litNetwork: "datil-dev",
    });

    const plaintext = await decryptSkillContent({
      content: payload,
      skillId,
      wallet: {},
      caller: author,
    }, {
      env: { NEXT_PUBLIC_LIT_MODE: "real" },
      chainConfig: { programId, cluster: "devnet" },
      importImpl,
      litNodeClient: { connected: true },
      authSig: { sig: "sig" },
    });

    expect(plaintext).toBe("# Decrypted");
  });
});
