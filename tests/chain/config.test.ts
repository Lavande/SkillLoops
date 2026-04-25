import { describe, it, expect } from "vitest";
import { getChainConfig } from "@/lib/chain/config";

describe("getChainConfig", () => {
  it("reads program id + rpc + cluster from env with defaults", () => {
    const c = getChainConfig({
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SOLANA_RPC: "https://api.devnet.solana.com",
      NEXT_PUBLIC_SLP_PROGRAM_ID: "BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ",
    });
    expect(c.cluster).toBe("devnet");
    expect(c.rpcUrl).toBe("https://api.devnet.solana.com");
    expect(c.programId.toBase58()).toBe("BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ");
  });

  it("defaults rpc when not provided", () => {
    const c = getChainConfig({
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SLP_PROGRAM_ID: "BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ",
    });
    expect(c.rpcUrl).toBe("https://api.devnet.solana.com");
  });

  it("throws if program id missing", () => {
    expect(() => getChainConfig({})).toThrow(/program id/i);
  });
});
