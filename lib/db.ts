import Database, { type Database as DB } from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT,
  OWNERSHIP_BPS,
  POINTS_PER_100BPS_DEFAULT,
} from "./domain/thresholds";

const DATA_DIR = path.join(process.cwd(), "data");
const SCOPED_DATA_DIR = path.join(DATA_DIR, "scoped");

let instance: DB | null = null;

export function getDb(dbPath?: string): DB {
  const resolvedPath = resolveDbPath(dbPath);
  if (instance && instance.name === resolvedPath) {
    if (resolvedPath === ":memory:" || fs.existsSync(resolvedPath)) return instance;
    closeDb();
  } else if (instance) {
    closeDb();
  }
  if (resolvedPath !== ":memory:" && !fs.existsSync(path.dirname(resolvedPath))) {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }
  const db = new Database(resolvedPath);
  db.pragma("busy_timeout = 5000");
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
  const p = instance?.name ?? resolveDbPath();
  closeDb();
  removeDbArtifacts(p);
}

export function resolveDbPath(dbPath?: string, env: Record<string, string | undefined> = process.env): string {
  if (dbPath) return dbPath;
  const programId = env.NEXT_PUBLIC_SLP_PROGRAM_ID?.trim();
  const cluster = (env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet").trim() || "devnet";
  const scope = programId || "unscoped";
  return path.join(SCOPED_DATA_DIR, cluster, scope, "slp.sqlite");
}

function removeDbArtifacts(dbPath: string) {
  if (dbPath === ":memory:") return;
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = `${dbPath}${suffix}`;
    if (fs.existsSync(file)) fs.rmSync(file);
  }
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
      author_ownership_bps INTEGER NOT NULL,
      contributor_pool_bps INTEGER NOT NULL,
      min_author_ratio_bps INTEGER NOT NULL,
      total_contributor_weight INTEGER NOT NULL,
      contributor_count INTEGER NOT NULL,
      points_per_100bps INTEGER NOT NULL,
      max_pool_increase_per_evaluation_bps INTEGER NOT NULL,
      last_snapshot_time INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS share_accounts (
      holder TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      contribution_weight INTEGER NOT NULL DEFAULT 0,
      lock_until INTEGER NOT NULL DEFAULT 0,
      first_contribution_at INTEGER,
      last_contribution_at INTEGER,
      PRIMARY KEY (holder, skill_id)
    );
    CREATE TABLE IF NOT EXISTS experiences (
      experience_id INTEGER NOT NULL,
      skill_id TEXT NOT NULL,
      contributor TEXT NOT NULL,
      skill_version INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      arweave_tx_id TEXT NOT NULL,
      bundle_json TEXT NOT NULL,
      status TEXT NOT NULL,
      contribution_score INTEGER,
      contribution_weight_delta INTEGER,
      ownership_delta_bps INTEGER,
      submitted_at INTEGER NOT NULL,
      evaluated_at INTEGER,
      judge_report_tx_id TEXT,
      judge_report_json TEXT,
      PRIMARY KEY (skill_id, experience_id)
    );
    CREATE TABLE IF NOT EXISTS revenue_pools (
      skill_id TEXT PRIMARY KEY,
      current_period_revenue INTEGER NOT NULL DEFAULT 0,
      total_lifetime_revenue INTEGER NOT NULL DEFAULT 0,
      current_period_start INTEGER NOT NULL,
      period_length INTEGER NOT NULL,
      snapshot_author_ownership_bps INTEGER NOT NULL DEFAULT 10000,
      snapshot_contributor_pool_bps INTEGER NOT NULL DEFAULT 0,
      last_settlement_time INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS revenue_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id TEXT NOT NULL,
      period_start INTEGER NOT NULL,
      period_end INTEGER NOT NULL,
      period_revenue INTEGER NOT NULL,
      snapshot_author_ownership_bps INTEGER NOT NULL,
      snapshot_contributor_pool_bps INTEGER NOT NULL
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
  migrateShareLedgerOwnershipColumns(db);
  migrateShareAccountWeightColumns(db);
  migrateExperienceWeightColumns(db);
  migrateRevenueSnapshotColumns(db);
}

function tableColumns(db: DB, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).map((c) => c.name);
}

function primaryKeyColumns(db: DB, table: string): string[] {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; pk: number }>)
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name);
}

function hasColumn(db: DB, table: string, column: string): boolean {
  return tableColumns(db, table).includes(column);
}

function migrateShareLedgerOwnershipColumns(db: DB) {
  const cols = tableColumns(db, "share_ledgers");
  if (cols.includes("author_ownership_bps")) return;
  if (!cols.includes("total_shares") || !cols.includes("author_shares")) return;

  const migrateOldShareLedgers = db.transaction(() => {
    db.exec(`
      CREATE TABLE share_ledgers_new (
        skill_id TEXT PRIMARY KEY,
        author_ownership_bps INTEGER NOT NULL,
        contributor_pool_bps INTEGER NOT NULL,
        min_author_ratio_bps INTEGER NOT NULL,
        total_contributor_weight INTEGER NOT NULL,
        contributor_count INTEGER NOT NULL,
        points_per_100bps INTEGER NOT NULL,
        max_pool_increase_per_evaluation_bps INTEGER NOT NULL,
        last_snapshot_time INTEGER NOT NULL
      );
      INSERT INTO share_ledgers_new (
        skill_id,
        author_ownership_bps,
        contributor_pool_bps,
        min_author_ratio_bps,
        total_contributor_weight,
        contributor_count,
        points_per_100bps,
        max_pool_increase_per_evaluation_bps,
        last_snapshot_time
      )
      SELECT
        l.skill_id,
        CASE
          WHEN l.total_shares > 0 THEN CAST((l.author_shares * ${OWNERSHIP_BPS}) / l.total_shares AS INTEGER)
          ELSE ${OWNERSHIP_BPS}
        END,
        CASE
          WHEN l.total_shares > 0 THEN ${OWNERSHIP_BPS} - CAST((l.author_shares * ${OWNERSHIP_BPS}) / l.total_shares AS INTEGER)
          ELSE 0
        END,
        l.min_author_ratio_bps,
        COALESCE((
          SELECT SUM(CASE WHEN s.author IS NOT NULL AND a.holder = s.author THEN 0 ELSE a.shares END)
          FROM share_accounts a
          LEFT JOIN skills s ON s.skill_id = a.skill_id
          WHERE a.skill_id = l.skill_id
        ), MAX(l.total_shares - l.author_shares, 0)),
        COALESCE((
          SELECT COUNT(*)
          FROM share_accounts a
          LEFT JOIN skills s ON s.skill_id = a.skill_id
          WHERE a.skill_id = l.skill_id
            AND (s.author IS NULL OR a.holder != s.author)
            AND a.shares > 0
        ), l.contributor_count),
        ${POINTS_PER_100BPS_DEFAULT},
        ${MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT},
        l.last_snapshot_time
      FROM share_ledgers l;
      DROP TABLE share_ledgers;
      ALTER TABLE share_ledgers_new RENAME TO share_ledgers;
    `);
  });
  migrateOldShareLedgers();
}

function migrateShareAccountWeightColumns(db: DB) {
  const cols = tableColumns(db, "share_accounts");
  if (cols.includes("contribution_weight")) return;
  if (!cols.includes("shares")) return;

  const migrateOldShareAccounts = db.transaction(() => {
    db.exec(`
      CREATE TABLE share_accounts_new (
        holder TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        contribution_weight INTEGER NOT NULL DEFAULT 0,
        lock_until INTEGER NOT NULL DEFAULT 0,
        first_contribution_at INTEGER,
        last_contribution_at INTEGER,
        PRIMARY KEY (holder, skill_id)
      );
      INSERT INTO share_accounts_new (
        holder,
        skill_id,
        contribution_weight,
        lock_until,
        first_contribution_at,
        last_contribution_at
      )
      SELECT
        a.holder,
        a.skill_id,
        CASE WHEN s.author IS NOT NULL AND a.holder = s.author THEN 0 ELSE a.shares END,
        a.lock_until,
        a.first_contribution_at,
        a.last_contribution_at
      FROM share_accounts a
      LEFT JOIN skills s ON s.skill_id = a.skill_id;
      DROP TABLE share_accounts;
      ALTER TABLE share_accounts_new RENAME TO share_accounts;
    `);
  });
  migrateOldShareAccounts();
}

function migrateExperienceWeightColumns(db: DB) {
  const cols = tableColumns(db, "experiences");
  const pk = primaryKeyColumns(db, "experiences");
  const needsRebuild =
    !cols.includes("contribution_weight_delta") ||
    !cols.includes("ownership_delta_bps") ||
    pk.join(",") !== "skill_id,experience_id";
  if (!needsRebuild) return;

  const contributionWeightDelta = cols.includes("contribution_weight_delta")
    ? "contribution_weight_delta"
    : cols.includes("shares_minted")
      ? "shares_minted"
      : "NULL";
  const ownershipDeltaBps = cols.includes("ownership_delta_bps") ? "ownership_delta_bps" : "0";

  const migrateOldExperiences = db.transaction(() => {
    db.exec(`
      CREATE TABLE experiences_new (
        experience_id INTEGER NOT NULL,
        skill_id TEXT NOT NULL,
        contributor TEXT NOT NULL,
        skill_version INTEGER NOT NULL,
        content_hash TEXT NOT NULL,
        arweave_tx_id TEXT NOT NULL,
        bundle_json TEXT NOT NULL,
        status TEXT NOT NULL,
        contribution_score INTEGER,
        contribution_weight_delta INTEGER,
        ownership_delta_bps INTEGER,
        submitted_at INTEGER NOT NULL,
        evaluated_at INTEGER,
        judge_report_tx_id TEXT,
        judge_report_json TEXT,
        PRIMARY KEY (skill_id, experience_id)
      );
      INSERT OR IGNORE INTO experiences_new (
        experience_id,
        skill_id,
        contributor,
        skill_version,
        content_hash,
        arweave_tx_id,
        bundle_json,
        status,
        contribution_score,
        contribution_weight_delta,
        ownership_delta_bps,
        submitted_at,
        evaluated_at,
        judge_report_tx_id,
        judge_report_json
      )
      SELECT
        experience_id,
        skill_id,
        contributor,
        skill_version,
        content_hash,
        arweave_tx_id,
        bundle_json,
        status,
        contribution_score,
        ${contributionWeightDelta},
        ${ownershipDeltaBps},
        submitted_at,
        evaluated_at,
        judge_report_tx_id,
        judge_report_json
      FROM experiences;
      DROP TABLE experiences;
      ALTER TABLE experiences_new RENAME TO experiences;
    `);
  });
  migrateOldExperiences();
}

function migrateRevenueSnapshotColumns(db: DB) {
  addColumnIfMissing(db, "revenue_pools", "snapshot_author_ownership_bps", "INTEGER NOT NULL DEFAULT 10000");
  addColumnIfMissing(db, "revenue_pools", "snapshot_contributor_pool_bps", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "revenue_pools", "last_settlement_time", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "revenue_history", "snapshot_author_ownership_bps", "INTEGER NOT NULL DEFAULT 10000");
  addColumnIfMissing(db, "revenue_history", "snapshot_contributor_pool_bps", "INTEGER NOT NULL DEFAULT 0");

  db.exec(`
    UPDATE revenue_pools
    SET
      snapshot_author_ownership_bps = COALESCE(
        (SELECT author_ownership_bps FROM share_ledgers WHERE share_ledgers.skill_id = revenue_pools.skill_id),
        snapshot_author_ownership_bps
      ),
      snapshot_contributor_pool_bps = COALESCE(
        (SELECT contributor_pool_bps FROM share_ledgers WHERE share_ledgers.skill_id = revenue_pools.skill_id),
        snapshot_contributor_pool_bps
      );
    UPDATE revenue_history
    SET
      snapshot_author_ownership_bps = COALESCE(
        (SELECT author_ownership_bps FROM share_ledgers WHERE share_ledgers.skill_id = revenue_history.skill_id),
        snapshot_author_ownership_bps
      ),
      snapshot_contributor_pool_bps = COALESCE(
        (SELECT contributor_pool_bps FROM share_ledgers WHERE share_ledgers.skill_id = revenue_history.skill_id),
        snapshot_contributor_pool_bps
      );
  `);
}

function addColumnIfMissing(db: DB, table: string, column: string, definition: string) {
  if (!hasColumn(db, table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
