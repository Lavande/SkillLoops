import { describe, it, expect } from "vitest";
import path from "node:path";
import { getChainConfig } from "@/lib/chain/config";
import { resolveDbPath } from "@/lib/db";

describe("getChainConfig", () => {
  it("reads program id + rpc + cluster from env with defaults", () => {
    const c = getChainConfig({
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SOLANA_RPC: "https://api.devnet.solana.com",
      NEXT_PUBLIC_SLP_PROGRAM_ID: "BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t",
    });
    expect(c.cluster).toBe("devnet");
    expect(c.rpcUrl).toBe("https://api.devnet.solana.com");
    expect(c.programId.toBase58()).toBe("BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t");
  });

  it("defaults rpc when not provided", () => {
    const c = getChainConfig({
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SLP_PROGRAM_ID: "BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t",
    });
    expect(c.rpcUrl).toBe("https://api.devnet.solana.com");
  });

  it("throws if program id missing", () => {
    expect(() => getChainConfig({})).toThrow(/program id/i);
  });

  it("scopes the sqlite path by cluster and program id", () => {
    const pathA = resolveDbPath(undefined, {
      NEXT_PUBLIC_SOLANA_CLUSTER: "devnet",
      NEXT_PUBLIC_SLP_PROGRAM_ID: "BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t",
    });
    expect(pathA).toBe(path.join(process.cwd(), "data", "scoped", "devnet", "BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t", "slp.sqlite"));
  });
});
