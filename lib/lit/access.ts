export interface SkillAccessInput {
  programId: string;
  skillId: string;
  author: string;
  cluster: "devnet" | "mainnet-beta" | "localnet";
}

export function buildSkillAccessConditions(input: SkillAccessInput): unknown[] {
  const chain = litSolanaChain(input.cluster);
  return [
    {
      method: "",
      params: [":userAddress"],
      chain,
      returnValueTest: {
        key: "",
        comparator: "=",
        value: input.author,
      },
    },
    { operator: "or" },
    {
      method: "getBalance(getPDA)",
      params: [],
      pdaParams: [input.programId, "sub", input.skillId, ":userAddress"],
      pdaInterface: { offset: 0, fields: {} },
      pdaKey: "",
      chain,
      returnValueTest: {
        key: "",
        comparator: ">",
        value: "0",
      },
    },
  ];
}

function litSolanaChain(_cluster: SkillAccessInput["cluster"]): "solana" {
  return "solana";
}
