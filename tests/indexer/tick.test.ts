import { describe, it, expect, beforeEach, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { _resetSingletonForTesting, getDb } from "@/lib/db";

const connMock = vi.hoisted(() => ({
  getTransaction: vi.fn(),
  getSignaturesForAddress: vi.fn(),
}));

vi.mock("@/lib/chain/connection", () => ({
  getConnection: () => connMock,
}));

vi.mock("@/lib/chain/config", () => ({
  getChainConfig: () => ({
    programId: new PublicKey("11111111111111111111111111111114"),
    cluster: "devnet",
    rpcUrl: "http://example.invalid",
  }),
}));

describe("indexer tick", () => {
  beforeEach(() => {
    _resetSingletonForTesting();
    connMock.getTransaction.mockReset();
    connMock.getSignaturesForAddress.mockReset();
    getDb().prepare(`DELETE FROM indexed_signatures WHERE signature = ?`).run("early_sig");
    _resetSingletonForTesting();
  });

  it("does not burn a signature when RPC has not returned logs yet", async () => {
    connMock.getTransaction.mockResolvedValueOnce({
      slot: 123,
      meta: { logMessages: null },
    });
    const { tick } = await import("@/lib/indexer");

    const result = await tick({ sig: "early_sig" });

    expect(result.processed).toBe(0);
    const db = getDb();
    const indexed = db
      .prepare(`SELECT status FROM indexed_signatures WHERE signature = ?`)
      .get("early_sig");
    expect(indexed).toBeUndefined();
  });
});
