import type { Connection } from "@solana/web3.js";
import { getDb } from "@/lib/db";
import { getConnection } from "./chain/connection";
import { getChainConfig } from "./chain/config";
import { decodeEvents, type SlpEvent } from "./chain/events";
import { now } from "@/lib/mock/clock";

interface IndexerState { running: boolean; lastTick: number }

const state: IndexerState = { running: false, lastTick: 0 };
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function isRunning(): boolean { return state.running; }

export function start(): void {
  if (intervalHandle) return;
  const interval = Number(process.env.INDEXER_POLL_INTERVAL_MS ?? "2000");
  state.running = true;
  intervalHandle = setInterval(() => { tick().catch((e) => console.error("[indexer]", e)); }, interval);
}

export function stop(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  state.running = false;
}

export async function tick(opts: { sig?: string } = {}): Promise<{ processed: number }> {
  const conn = getConnection();
  const { programId } = getChainConfig();
  const db = getDb();
  let processed = 0;

  if (opts.sig) {
    if (isAlreadyIndexed(db, opts.sig)) return { processed: 0 };
    const tx = await conn.getTransaction(opts.sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx) return { processed: 0 };
    await processOne(conn, db, opts.sig, tx.slot, tx.meta?.logMessages ?? []);
    processed += 1;
    state.lastTick = now();
    return { processed };
  }

  const lastSeen = getLastSeenSig(db);
  const sigs = await conn.getSignaturesForAddress(programId, { until: lastSeen ?? undefined, limit: 100 });
  for (let i = sigs.length - 1; i >= 0; i--) {
    const s = sigs[i];
    if (isAlreadyIndexed(db, s.signature)) continue;
    const tx = await conn.getTransaction(s.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx) continue;
    await processOne(conn, db, s.signature, s.slot, tx.meta?.logMessages ?? []);
    setLastSeenSig(db, s.signature, s.slot);
    processed += 1;
  }
  state.lastTick = now();
  return { processed };
}

function isAlreadyIndexed(db: ReturnType<typeof getDb>, sig: string): boolean {
  const row = db.prepare(`SELECT 1 FROM indexed_signatures WHERE signature = ?`).get(sig);
  return Boolean(row);
}

function getLastSeenSig(db: ReturnType<typeof getDb>): string | null {
  const row = db.prepare(`SELECT last_seen_sig FROM indexer_state WHERE id = 1`).get() as any;
  return row?.last_seen_sig ?? null;
}

function setLastSeenSig(db: ReturnType<typeof getDb>, sig: string, slot: number) {
  db.prepare(`INSERT INTO indexer_state (id, last_seen_sig, last_seen_slot, updated_at)
              VALUES (1, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET last_seen_sig = excluded.last_seen_sig,
                                            last_seen_slot = excluded.last_seen_slot,
                                            updated_at = excluded.updated_at`)
    .run(sig, slot, now());
}

async function processOne(
  _conn: Connection, db: ReturnType<typeof getDb>, sig: string, slot: number, logs: string[],
) {
  const events = decodeEvents(logs);
  const t = now();
  const tx = db.transaction(() => {
    for (const ev of events) applyEvent(db, ev, sig, slot);
    db.prepare(`INSERT OR REPLACE INTO indexed_signatures (signature, slot, status, error_code, processed_at)
                VALUES (?, ?, 'ok', NULL, ?)`).run(sig, slot, t);
  });
  try { tx(); }
  catch (e) {
    db.prepare(`INSERT OR REPLACE INTO indexed_signatures (signature, slot, status, error_code, processed_at)
                VALUES (?, ?, 'parse_failed', ?, ?)`)
      .run(sig, slot, (e as Error).message ?? "parse_failed", t);
  }
  // Post-commit async fetches (account data) get scheduled here once Task 15 wires applyEvent full.
}

function applyEvent(_db: ReturnType<typeof getDb>, _ev: SlpEvent, _sig: string, _slot: number): void {
  // Filled in Task 15.
}
