import { LAMPORTS_PER_SOL } from "./domain/thresholds";

export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}
export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}
export function fmtSol(lamports: number, places = 4): string {
  return `${lamportsToSol(lamports).toFixed(places)} SOL`;
}
export function fmtTimeDelta(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.max(0, Math.floor(seconds % 60));
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
