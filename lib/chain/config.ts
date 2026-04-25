import { PublicKey } from "@solana/web3.js";

export interface ChainConfig {
  cluster: "devnet" | "mainnet-beta" | "localnet";
  rpcUrl: string;
  programId: PublicKey;
}

const DEFAULT_RPC: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  localnet: "http://127.0.0.1:8899",
};

export function getChainConfig(env?: Record<string, string | undefined>): ChainConfig {
  const programIdStr = env?.NEXT_PUBLIC_SLP_PROGRAM_ID || process.env.NEXT_PUBLIC_SLP_PROGRAM_ID;
  if (!programIdStr) throw new Error("NEXT_PUBLIC_SLP_PROGRAM_ID (program id) is required");
  const cluster = (env?.NEXT_PUBLIC_SOLANA_CLUSTER || process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet") as ChainConfig["cluster"];
  const rpcUrl = env?.NEXT_PUBLIC_SOLANA_RPC || process.env.NEXT_PUBLIC_SOLANA_RPC || DEFAULT_RPC[cluster] || DEFAULT_RPC.devnet;
  return { cluster, rpcUrl, programId: new PublicKey(programIdStr) };
}
