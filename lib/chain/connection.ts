import { Connection } from "@solana/web3.js";
import { getChainConfig } from "./config";

let instance: Connection | null = null;

export function getConnection(): Connection {
  if (instance) return instance;
  const { rpcUrl } = getChainConfig();
  instance = new Connection(rpcUrl, "confirmed");
  return instance;
}
