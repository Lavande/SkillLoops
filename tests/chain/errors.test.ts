import { describe, it, expect } from "vitest";
import { parseChainError, ChainError, ERROR_MESSAGES } from "@/lib/chain/errors";

describe("parseChainError", () => {
  it("extracts error code from Anchor error", () => {
    const fake = { error: { errorCode: { code: "ScoreOutOfRange", number: 6002 }, errorMessage: "Score must be 0..=50" } };
    const e = parseChainError(fake);
    expect(e).toBeInstanceOf(ChainError);
    expect(e.code).toBe("ScoreOutOfRange");
    expect(e.message).toBe(ERROR_MESSAGES.ScoreOutOfRange);
  });

  it("falls back to 'Unknown' for non-Anchor errors", () => {
    const e = parseChainError(new Error("rpc down"));
    expect(e.code).toBe("Unknown");
  });

  it("detects user rejection as SignatureDeclined", () => {
    const e = parseChainError(new Error("User rejected the request."));
    expect(e.code).toBe("SignatureDeclined");
  });
});
