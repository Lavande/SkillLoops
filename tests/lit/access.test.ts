import { describe, expect, it } from "vitest";
import { buildSkillAccessConditions } from "@/lib/lit/access";

const programId = "BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t";
const skillId = "7q6akTn3VYDoJjZ6Z8VFZrqmTuY7zj4KkT8hC8Q7DAoY";
const author = "4oP88QmGg3TQeNYK8VfLR8EAwV96AcNmQMiYhDMnSCPu";

describe("buildSkillAccessConditions", () => {
  it("allows the author wallet via the authenticated Solana user address", () => {
    const conditions = buildSkillAccessConditions({ programId, skillId, author, cluster: "devnet" }) as any[];

    expect(conditions[0]).toEqual({
      method: "",
      params: [":userAddress"],
      chain: "solana",
      returnValueTest: {
        key: "",
        comparator: "=",
        value: author,
      },
    });
  });

  it("combines author and subscriber branches with an OR", () => {
    const conditions = buildSkillAccessConditions({ programId, skillId, author, cluster: "devnet" }) as any[];

    expect(conditions[1]).toEqual({ operator: "or" });
  });

  it("derives the subscription PDA from program, skill, and authenticated user", () => {
    const conditions = buildSkillAccessConditions({ programId, skillId, author, cluster: "devnet" }) as any[];
    const subCondition = conditions[2];

    expect(subCondition).toMatchObject({
      method: "getBalance(getPDA)",
      params: [],
      pdaParams: [programId, "sub", skillId, ":userAddress"],
      pdaInterface: { offset: 0, fields: {} },
      pdaKey: "",
      chain: "solana",
      returnValueTest: {
        key: "",
        comparator: ">",
        value: "0",
      },
    });
  });

  it("maps mainnet-beta to Lit's solana chain string", () => {
    const conditions = buildSkillAccessConditions({ programId, skillId, author, cluster: "mainnet-beta" }) as any[];

    expect(conditions[0].chain).toBe("solana");
    expect(conditions[2].chain).toBe("solana");
  });
});
