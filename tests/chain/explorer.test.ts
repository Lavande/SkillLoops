import { describe, it, expect } from "vitest";
import { txLink, accountLink } from "@/lib/chain/explorer";

describe("explorer links", () => {
  it("devnet tx link includes cluster=devnet", () => {
    const link = txLink("5sig", "devnet");
    expect(link).toBe("https://explorer.solana.com/tx/5sig?cluster=devnet");
  });
  it("mainnet tx link omits cluster param", () => {
    const link = txLink("5sig", "mainnet-beta");
    expect(link).toBe("https://explorer.solana.com/tx/5sig");
  });
  it("account link handles devnet", () => {
    const link = accountLink("pubkey", "devnet");
    expect(link).toBe("https://explorer.solana.com/address/pubkey?cluster=devnet");
  });
});
