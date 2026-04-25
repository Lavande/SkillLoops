import Database, { type Database as DB } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const DEFAULT_PATH = path.join(DATA_DIR, "slp.sqlite");

let instance: DB | null = null;

export function getDb(dbPath = DEFAULT_PATH): DB {
  if (instance && instance.name === dbPath) return instance;
  if (dbPath !== ":memory:" && !fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  instance = db;
  return db;
}

export function closeDb() {
  instance?.close();
  instance = null;
}

export function _resetSingletonForTesting() { instance = null; }

export function resetDb() {
  const p = instance?.name;
  closeDb();
  if (p && p !== ":memory:" && fs.existsSync(p)) fs.rmSync(p);
}

function migrate(db: DB) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      skill_id TEXT PRIMARY KEY,
      author TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      current_version INTEGER NOT NULL DEFAULT 1,
      content_hash TEXT NOT NULL,
      arweave_tx_id TEXT NOT NULL,
      subscription_price INTEGER NOT NULL,
      min_author_ratio_bps INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      subscriber_count INTEGER NOT NULL DEFAULT 0,
      total_revenue INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS skill_versions (
      skill_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      arweave_tx_id TEXT NOT NULL,
      contributing_experience_ids TEXT NOT NULL,
      published_at INTEGER NOT NULL,
      PRIMARY KEY (skill_id, version)
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      subscriber TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      expiry_time INTEGER NOT NULL,
      total_calls INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (subscriber, skill_id)
    );
    CREATE TABLE IF NOT EXISTS share_ledgers (
      skill_id TEXT PRIMARY KEY,
      total_shares INTEGER NOT NULL,
      author_shares INTEGER NOT NULL,
      min_author_ratio_bps INTEGER NOT NULL,
      contributor_count INTEGER NOT NULL,
      last_snapshot_time INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS share_accounts (
      holder TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      shares INTEGER NOT NULL DEFAULT 0,
      lock_until INTEGER NOT NULL DEFAULT 0,
      first_contribution_at INTEGER,
      last_contribution_at INTEGER,
      PRIMARY KEY (holder, skill_id)
    );
    CREATE TABLE IF NOT EXISTS experiences (
      experience_id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id TEXT NOT NULL,
      contributor TEXT NOT NULL,
      skill_version INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      arweave_tx_id TEXT NOT NULL,
      bundle_json TEXT NOT NULL,
      status TEXT NOT NULL,
      contribution_score INTEGER,
      shares_minted INTEGER,
      submitted_at INTEGER NOT NULL,
      evaluated_at INTEGER,
      judge_report_tx_id TEXT,
      judge_report_json TEXT
    );
    CREATE TABLE IF NOT EXISTS revenue_pools (
      skill_id TEXT PRIMARY KEY,
      current_period_revenue INTEGER NOT NULL DEFAULT 0,
      total_lifetime_revenue INTEGER NOT NULL DEFAULT 0,
      current_period_start INTEGER NOT NULL,
      period_length INTEGER NOT NULL,
      snapshot_total_shares INTEGER NOT NULL DEFAULT 0,
      last_settlement_time INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS revenue_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id TEXT NOT NULL,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      period_revenue INTEGER NOT NULL,
      snapshot_total_shares INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS claimable_revenue (
      holder TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      snapshot_id INTEGER NOT NULL,
      PRIMARY KEY (holder, skill_id, snapshot_id)
    );
    CREATE TABLE IF NOT EXISTS arweave_objects (
      tx_id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      tags TEXT NOT NULL,
      owner TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS balances (
      holder TEXT PRIMARY KEY,
      lamports INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS indexer_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_seen_sig TEXT,
      last_seen_slot INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS indexed_signatures (
      signature TEXT PRIMARY KEY,
      slot INTEGER NOT NULL,
      status TEXT NOT NULL,
      error_code TEXT,
      processed_at INTEGER NOT NULL
    );
  `);
}
