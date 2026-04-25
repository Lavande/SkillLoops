import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { getConnection } from "./chain/connection";
import { LAMPORTS_PER_SOL } from "./domain/thresholds";

export function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function getSolBalance(holder: string): Promise<number> {
  try {
    const conn = getConnection();
    return await conn.getBalance(new PublicKey(holder));
  } catch {
    return 0;
  }
}

export function getPeriodLengthSeconds(): number {
  const raw = Number(process.env.NEXT_PUBLIC_PERIOD_LENGTH_SECONDS ?? "300");
  if (!Number.isFinite(raw) || raw <= 0) return 300;
  return raw;
}

export const SOL = LAMPORTS_PER_SOL;
