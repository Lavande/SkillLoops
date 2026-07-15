import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import type { Database as DB } from "better-sqlite3";
import { getDb } from "@/lib/db";
import { getConnection } from "./chain/connection";
import { getChainConfig } from "./chain/config";
import { decodeEvents, type SlpEvent } from "./chain/events";
import { pdas } from "./chain/pdas";
import { now } from "@/lib/mock/clock";

interface IndexerState { running: boolean; lastTick: number }

interface IndexerRuntime {
  state: IndexerState;
  intervalHandle: ReturnType<typeof setInterval> | null;
}

const globalForIndexer = globalThis as typeof globalThis & {
  __slpIndexerRuntime?: IndexerRuntime;
};
const runtime = globalForIndexer.__slpIndexerRuntime ??= {
  state: { running: false, lastTick: 0 },
  intervalHandle: null,
};
const state = runtime.state;

export function isRunning(): boolean { return state.running; }

export function start(): void {
  if (runtime.intervalHandle) return;
  const interval = Number(process.env.INDEXER_POLL_INTERVAL_MS ?? "2000");
  state.running = true;
  runtime.intervalHandle = setInterval(() => { tick().catch((e) => console.error("[indexer]", e)); }, interval);
}

export function stop(): void {
  if (runtime.intervalHandle) clearInterval(runtime.intervalHandle);
  runtime.intervalHandle = null;
  state.running = false;
}

export async function tick(opts: { sig?: string } = {}): Promise<{ processed: number }> {
  const conn = getConnection();
  const { programId } = getChainConfig();
  const db = getDb();
  let processed = 0;

  await hydrateMissingSkillProjections(conn, db);

  if (opts.sig) {
    if (isAlreadyIndexed(db, opts.sig)) return { processed: 0 };
    const tx = await conn.getTransaction(opts.sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
    if (!tx) return { processed: 0 };
    const logs = tx.meta?.logMessages;
    if (!logs?.length) return { processed: 0 };
    await processOne(conn, db, opts.sig, tx.slot, logs);
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
    const logs = tx.meta?.logMessages;
    if (!logs?.length) continue;
    await processOne(conn, db, s.signature, s.slot, logs);
    setLastSeenSig(db, s.signature, s.slot);
    processed += 1;
  }
  state.lastTick = now();
  return { processed };
}

function isAlreadyIndexed(db: DB, sig: string): boolean {
  const row = db.prepare(`SELECT 1 FROM indexed_signatures WHERE signature = ?`).get(sig);
  return Boolean(row);
}

function getLastSeenSig(db: DB): string | null {
  const row = db.prepare(`SELECT last_seen_sig FROM indexer_state WHERE id = 1`).get() as any;
  return row?.last_seen_sig ?? null;
}

function setLastSeenSig(db: DB, sig: string, slot: number) {
  db.prepare(`INSERT INTO indexer_state (id, last_seen_sig, last_seen_slot, updated_at)
              VALUES (1, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET last_seen_sig = excluded.last_seen_sig,
                                            last_seen_slot = excluded.last_seen_slot,
                                            updated_at = excluded.updated_at`)
    .run(sig, slot, now());
}

async function processOne(
  conn: Connection, db: DB, sig: string, slot: number, logs: string[],
) {
  const events = decodeEvents(logs);
  const t = now();
  const tx = db.transaction(() => {
    for (const ev of events) applyEventLocal(db, ev);
    db.prepare(`INSERT OR REPLACE INTO indexed_signatures (signature, slot, status, error_code, processed_at)
                VALUES (?, ?, 'ok', NULL, ?)`).run(sig, slot, t);
  });
  try { tx(); }
  catch (e) {
    db.prepare(`INSERT OR REPLACE INTO indexed_signatures (signature, slot, status, error_code, processed_at)
                VALUES (?, ?, 'parse_failed', ?, ?)`)
      .run(sig, slot, (e as Error).message ?? "parse_failed", t);
    return;
  }
  // Post-commit enrichment: fetch on-chain account data for events that need it.
  for (const ev of events) {
    try { await enrichAfterCommit(conn, db, ev); } catch (e) { console.error("[indexer] enrich failed:", e); }
  }
}

// Exported for testing only — calls applyEventLocal without needing a Connection.
export async function applyEventForTest(
  db: DB, ev: SlpEvent, sig: string, _slot: number, _skipFetch: boolean,
): Promise<void> {
  const already = db.prepare(`SELECT 1 FROM indexed_signatures WHERE signature = ?`).get(sig);
  if (already) return;
  applyEventLocal(db, ev);
}

// Exported for testing only — exercises post-commit RPC enrichment.
export async function enrichAfterCommitForTest(conn: Connection, db: DB, ev: SlpEvent): Promise<void> {
  await enrichAfterCommit(conn, db, ev);
}

function applyEventLocal(db: DB, ev: SlpEvent): void {
  const t = now();
  switch (ev.name) {
    case "SkillPublished": {
      const skillId = (ev.data.skill as PublicKey).toBase58();
      const author = (ev.data.author as PublicKey).toBase58();
      const createdAt = Number(ev.data.createdAt);
      db.prepare(`INSERT OR IGNORE INTO skills
        (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at, subscriber_count, total_revenue)
        VALUES (?,?,?,?,?,1,?,?,?,?,?,?,0,0)`)
        .run(skillId, author, "<pending>", "", "uncategorized",
             "", "", 0, 0, createdAt, createdAt);
      db.prepare(`INSERT OR IGNORE INTO share_ledgers
        (skill_id, author_ownership_bps, contributor_pool_bps, min_author_ratio_bps, total_contributor_weight, contributor_count, points_per_100bps, max_pool_increase_per_evaluation_bps, last_snapshot_time)
        VALUES (?, 10000, 0, 0, 0, 0, 250, 500, ?)`).run(skillId, createdAt);
      db.prepare(`INSERT OR IGNORE INTO share_accounts
        (holder, skill_id, contribution_weight, lock_until, first_contribution_at, last_contribution_at)
        VALUES (?, ?, 0, 0, NULL, NULL)`).run(author, skillId);
      db.prepare(`INSERT OR IGNORE INTO revenue_pools
        (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length, snapshot_author_ownership_bps, snapshot_contributor_pool_bps, last_settlement_time)
        VALUES (?, 0, 0, ?, 300, 10000, 0, 0)`).run(skillId, createdAt);
      db.prepare(`INSERT OR IGNORE INTO skill_versions
        (skill_id, version, content_hash, arweave_tx_id, contributing_experience_ids, published_at)
        VALUES (?, 1, '', '', '[]', ?)`).run(skillId, createdAt);
      return;
    }
    case "Subscribed": {
      const skillId = (ev.data.skill as PublicKey).toBase58();
      const subscriber = (ev.data.subscriber as PublicKey).toBase58();
      const expiry = Number(ev.data.expiryTime);
      const existing = db.prepare(`SELECT 1 FROM subscriptions WHERE subscriber=? AND skill_id=?`).get(subscriber, skillId);
      const skillRow = db.prepare(`SELECT subscription_price FROM skills WHERE skill_id = ?`).get(skillId) as any;
      const price = skillRow?.subscription_price ?? 0;
      if (!existing) {
        db.prepare(`INSERT INTO subscriptions (subscriber, skill_id, start_time, expiry_time, total_calls, is_active) VALUES (?,?,?,?,0,1)`)
          .run(subscriber, skillId, t, expiry);
        db.prepare(`UPDATE skills SET subscriber_count = subscriber_count + 1 WHERE skill_id = ?`).run(skillId);
      } else {
        db.prepare(`UPDATE subscriptions SET expiry_time = ?, is_active = 1 WHERE subscriber = ? AND skill_id = ?`)
          .run(expiry, subscriber, skillId);
      }
      db.prepare(`INSERT OR IGNORE INTO share_accounts (holder, skill_id, contribution_weight, lock_until) VALUES (?,?,0,0)`)
        .run(subscriber, skillId);
      db.prepare(`UPDATE skills SET total_revenue = total_revenue + ? WHERE skill_id = ?`).run(price, skillId);
      db.prepare(`UPDATE revenue_pools SET current_period_revenue = current_period_revenue + ? WHERE skill_id = ?`).run(price, skillId);
      return;
    }
    case "ExperienceSubmitted": {
      const skillId = (ev.data.skill as PublicKey).toBase58();
      const experienceId = Number(ev.data.experienceId);
      const contributor = (ev.data.contributor as PublicKey).toBase58();
      db.prepare(`INSERT OR IGNORE INTO experiences
        (experience_id, skill_id, contributor, skill_version, content_hash, arweave_tx_id, bundle_json, status, submitted_at)
        VALUES (?,?,?,1,'','','','Pending',?)`)
        .run(experienceId, skillId, contributor, t);
      db.prepare(`INSERT OR IGNORE INTO share_accounts (holder, skill_id, contribution_weight, lock_until) VALUES (?,?,0,0)`)
        .run(contributor, skillId);
      return;
    }
    case "ExperienceEvaluated": {
      const skillId = (ev.data.skill as PublicKey).toBase58();
      const experienceId = Number(ev.data.experienceId);
      const contributor = (ev.data.contributor as PublicKey).toBase58();
      const score = Number(ev.data.score);
      const contributionWeightDelta = Number(ev.data.contributionWeightDelta);
      const ownershipDeltaBps = Number(ev.data.ownershipDeltaBps);
      const authorOwnershipBps = Number(ev.data.authorOwnershipBps);
      const contributorPoolBps = Number(ev.data.contributorPoolBps);
      const approved = Boolean(ev.data.approved);
      db.prepare(`UPDATE experiences
          SET status = ?, contribution_score = ?, contribution_weight_delta = ?, ownership_delta_bps = ?, evaluated_at = ?
          WHERE skill_id = ? AND experience_id = ?`)
        .run(approved ? "Evaluated" : "Rejected", score, contributionWeightDelta, ownershipDeltaBps, t, skillId, experienceId);
      db.prepare(`UPDATE share_ledgers
          SET author_ownership_bps = ?,
              contributor_pool_bps = ?,
              last_snapshot_time = ?
          WHERE skill_id = ?`)
        .run(authorOwnershipBps, contributorPoolBps, t, skillId);
      if (approved && contributionWeightDelta > 0) {
        const existing = db.prepare(`SELECT contribution_weight FROM share_accounts WHERE holder=? AND skill_id=?`).get(contributor, skillId) as any;
        const wasZero = Number(existing?.contribution_weight ?? 0) === 0;
        db.prepare(`INSERT OR IGNORE INTO share_accounts (holder, skill_id, contribution_weight, lock_until) VALUES (?,?,0,0)`)
          .run(contributor, skillId);
        db.prepare(`UPDATE share_accounts
          SET contribution_weight = contribution_weight + ?,
              lock_until = ?,
              first_contribution_at = COALESCE(first_contribution_at, ?),
              last_contribution_at = ?
          WHERE holder = ? AND skill_id = ?`)
          .run(contributionWeightDelta, t + 180 * 24 * 60 * 60, t, t, contributor, skillId);
        db.prepare(`UPDATE share_ledgers
          SET total_contributor_weight = total_contributor_weight + ?,
              contributor_count = contributor_count + ?
          WHERE skill_id = ?`)
          .run(contributionWeightDelta, wasZero ? 1 : 0, skillId);
      }
      return;
    }
    case "PeriodSettled": {
      const skillId = (ev.data.skill as PublicKey).toBase58();
      const periodRevenue = Number(ev.data.periodRevenue);
      const authorOwnershipBps = Number(ev.data.authorOwnershipBps);
      const contributorPoolBps = Number(ev.data.contributorPoolBps);
      const pool = db.prepare(`SELECT current_period_start, period_length FROM revenue_pools WHERE skill_id = ?`).get(skillId) as any;
      const periodStart = pool?.current_period_start ?? t;
      db.prepare(`INSERT INTO revenue_history
          (skill_id, period_start, period_end, period_revenue, snapshot_author_ownership_bps, snapshot_contributor_pool_bps)
          VALUES (?,?,?,?,?,?)`)
        .run(skillId, periodStart, t, periodRevenue, authorOwnershipBps, contributorPoolBps);
      db.prepare(`UPDATE revenue_pools SET
          current_period_revenue = 0,
          total_lifetime_revenue = total_lifetime_revenue + ?,
          current_period_start = ?,
          snapshot_author_ownership_bps = ?,
          snapshot_contributor_pool_bps = ?,
          last_settlement_time = ?
          WHERE skill_id = ?`)
        .run(periodRevenue, t, authorOwnershipBps, contributorPoolBps, t, skillId);
      // per-holder claimable rows are backfilled via enrichAfterCommit (getProgramAccounts)
      return;
    }
    case "RevenueClaimed": {
      const skillId = (ev.data.skill as PublicKey).toBase58();
      const holder = (ev.data.holder as PublicKey).toBase58();
      const snapshotId = Number(ev.data.snapshotId);
      db.prepare(`UPDATE claimable_revenue SET amount = 0 WHERE holder = ? AND skill_id = ? AND snapshot_id = ?`)
        .run(holder, skillId, snapshotId);
      return;
    }
    case "VersionPublished": {
      const skillId = (ev.data.skill as PublicKey).toBase58();
      const version = Number(ev.data.version);
      db.prepare(`INSERT OR IGNORE INTO skill_versions (skill_id, version, content_hash, arweave_tx_id, contributing_experience_ids, published_at) VALUES (?,?, '', '', '[]', ?)`)
        .run(skillId, version, t);
      db.prepare(`UPDATE skills SET current_version = ?, updated_at = ? WHERE skill_id = ?`)
        .run(version, t, skillId);
      return;
    }
  }
}

async function enrichAfterCommit(conn: Connection, db: DB, ev: SlpEvent): Promise<void> {
  const { getProgram } = await import("./chain/program");
  const program = getProgram(conn, {
    publicKey: new PublicKey("11111111111111111111111111111112"),
    signTransaction: async (t: any) => t,
  });
  if (ev.name === "SkillPublished") {
    const skillPk = ev.data.skill as PublicKey;
    try {
      const acct = await (program.account as any).skill.fetch(skillPk);
      db.prepare(`UPDATE skills SET
          name = ?, description = ?, category = ?,
          content_hash = ?, arweave_tx_id = ?,
          subscription_price = ?, min_author_ratio_bps = ?
          WHERE skill_id = ?`)
        .run(acct.name, acct.description, acct.category,
             Buffer.from(acct.contentHash).toString("hex"), acct.arweaveTxId,
             Number(acct.subscriptionPrice.toString()), acct.minAuthorRatioBps,
             skillPk.toBase58());
      db.prepare(`UPDATE share_ledgers SET min_author_ratio_bps = ? WHERE skill_id = ?`)
        .run(acct.minAuthorRatioBps, skillPk.toBase58());
    } catch (e) { console.error("[indexer] enrich skill failed", e); }
  }
  if (ev.name === "ExperienceSubmitted") {
    const skillPk = ev.data.skill as PublicKey;
    try {
      await hydrateSkillProjection(conn, db, skillPk);
    } catch (e) {
      console.error("[indexer] hydrate submitted skill failed", e);
    }
    const experienceId = BigInt(ev.data.experienceId.toString());
    const [experiencePk] = pdas.experience(getChainConfig().programId, skillPk, experienceId);
    try {
      const acct = await (program.account as any).experienceRecord.fetch(experiencePk);
      const submittedAt = Number(acct.submittedAt?.toString?.() ?? acct.submittedAt);
      db.prepare(`UPDATE experiences SET
          skill_version = ?,
          content_hash = ?,
          arweave_tx_id = ?,
          submitted_at = ?
          WHERE skill_id = ? AND experience_id = ?`)
        .run(
          Number(acct.skillVersion?.toString?.() ?? acct.skillVersion),
          Buffer.from(acct.contentHash).toString("hex"),
          acct.arweaveTxId,
          submittedAt,
          skillPk.toBase58(),
          Number(experienceId),
        );
    } catch (e) { console.error("[indexer] enrich experience failed", e); }
  }
  if (ev.name === "ExperienceEvaluated") {
    const skillPk = ev.data.skill as PublicKey;
    const experienceId = BigInt(ev.data.experienceId.toString());
    const [experiencePk] = pdas.experience(getChainConfig().programId, skillPk, experienceId);
    try {
      const acct = await (program.account as any).experienceRecord.fetch(experiencePk);
      db.prepare(`UPDATE experiences SET
          contribution_weight_delta = ?,
          ownership_delta_bps = ?,
          evaluated_at = ?,
          judge_report_tx_id = ?
          WHERE skill_id = ? AND experience_id = ?`)
        .run(
          Number(acct.contributionWeightDelta?.toString?.() ?? acct.contributionWeightDelta),
          Number(acct.ownershipDeltaBps?.toString?.() ?? acct.ownershipDeltaBps),
          Number(acct.evaluatedAt?.toString?.() ?? acct.evaluatedAt),
          acct.judgeReportTxId,
          skillPk.toBase58(),
          Number(experienceId),
        );
    } catch (e) { console.error("[indexer] enrich evaluated experience failed", e); }
  }
  if (ev.name === "PeriodSettled") {
    const skillPk = ev.data.skill as PublicKey;
    const snapshotId = BigInt(ev.data.snapshotId.toString());
    try {
      const all = await (program.account as any).claimableRevenue.all([
        { memcmp: { offset: 8 + 32, bytes: skillPk.toBase58() } },
      ]);
      for (const item of all) {
        if (Number(item.account.snapshotId.toString()) !== Number(snapshotId)) continue;
        db.prepare(`INSERT OR REPLACE INTO claimable_revenue (holder, skill_id, amount, snapshot_id) VALUES (?,?,?,?)`)
          .run(item.account.holder.toBase58(), skillPk.toBase58(),
               Number(item.account.amount.toString()), Number(snapshotId));
      }
    } catch (e) { console.error("[indexer] enrich claims failed", e); }
  }
}

async function hydrateMissingSkillProjections(conn: Connection, db: DB): Promise<void> {
  const rows = db.prepare(`SELECT DISTINCT e.skill_id
    FROM experiences e
    LEFT JOIN skills s ON s.skill_id = e.skill_id
    WHERE s.skill_id IS NULL`).all() as { skill_id: string }[];
  for (const row of rows) {
    try {
      await hydrateSkillProjection(conn, db, new PublicKey(row.skill_id));
    } catch (e) {
      console.error("[indexer] hydrate missing skill failed", e);
    }
  }
}

async function hydrateSkillProjection(conn: Connection, db: DB, skillPk: PublicKey): Promise<void> {
  const skillId = skillPk.toBase58();
  if (db.prepare(`SELECT 1 FROM skills WHERE skill_id = ?`).get(skillId)) return;

  const { getProgram } = await import("./chain/program");
  const { programId } = getChainConfig();
  const program = getProgram(conn, {
    publicKey: new PublicKey("11111111111111111111111111111112"),
    signTransaction: async (t: any) => t,
  }, programId);
  const [ledgerPk] = pdas.shareLedger(programId, skillPk);
  const [poolPk] = pdas.revenuePool(programId, skillPk);
  const [skillAcct, ledgerAcct, poolAcct] = await Promise.all([
    (program.account as any).skill.fetch(skillPk),
    (program.account as any).shareLedger.fetch(ledgerPk),
    (program.account as any).revenuePool.fetch(poolPk),
  ]);
  const currentVersion = Number(skillAcct.currentVersion?.toString?.() ?? skillAcct.currentVersion);
  const [versionPk] = pdas.skillVersion(programId, skillPk, currentVersion);
  const versionAcct = await (program.account as any).skillVersion.fetch(versionPk);

  const holders = new Set<string>([
    skillAcct.author.toBase58(),
    ...(db.prepare(`SELECT DISTINCT contributor FROM experiences WHERE skill_id = ?`).all(skillId) as { contributor: string }[])
      .map((row) => row.contributor),
  ]);
  const shareAccounts: any[] = [];
  for (const holder of holders) {
    const holderPk = new PublicKey(holder);
    const [sharePk] = pdas.shareAccount(programId, skillPk, holderPk);
    try {
      shareAccounts.push(await (program.account as any).shareAccount.fetch(sharePk));
    } catch {
      // A pending contributor may not have a share account yet.
    }
  }

  const number = (value: any) => Number(value?.toString?.() ?? value);
  db.transaction(() => {
    db.prepare(`INSERT INTO skills
      (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id,
       subscription_price, min_author_ratio_bps, created_at, updated_at, subscriber_count, total_revenue)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        skillId,
        skillAcct.author.toBase58(),
        skillAcct.name,
        skillAcct.description,
        skillAcct.category,
        currentVersion,
        Buffer.from(skillAcct.contentHash).toString("hex"),
        skillAcct.arweaveTxId,
        number(skillAcct.subscriptionPrice),
        number(skillAcct.minAuthorRatioBps),
        number(skillAcct.createdAt),
        number(skillAcct.updatedAt),
        number(skillAcct.subscriberCount),
        number(skillAcct.totalRevenue),
      );
    db.prepare(`INSERT INTO share_ledgers
      (skill_id, author_ownership_bps, contributor_pool_bps, min_author_ratio_bps,
       total_contributor_weight, contributor_count, points_per_100bps,
       max_pool_increase_per_evaluation_bps, last_snapshot_time)
      VALUES (?,?,?,?,?,?,?,?,?)`).run(
        skillId,
        number(ledgerAcct.authorOwnershipBps),
        number(ledgerAcct.contributorPoolBps),
        number(ledgerAcct.minAuthorRatioBps),
        number(ledgerAcct.totalContributorWeight),
        number(ledgerAcct.contributorCount),
        number(ledgerAcct.pointsPer100bps),
        number(ledgerAcct.maxPoolIncreasePerEvaluationBps),
        number(ledgerAcct.lastSnapshotTime),
      );
    db.prepare(`INSERT INTO revenue_pools
      (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length,
       snapshot_author_ownership_bps, snapshot_contributor_pool_bps, last_settlement_time)
      VALUES (?,?,?,?,?,?,?,?)`).run(
        skillId,
        number(poolAcct.currentPeriodRevenue),
        number(poolAcct.totalLifetimeRevenue),
        number(poolAcct.currentPeriodStart),
        number(poolAcct.periodLength),
        number(poolAcct.snapshotAuthorOwnershipBps),
        number(poolAcct.snapshotContributorPoolBps),
        number(poolAcct.lastSettlementTime),
      );
    db.prepare(`INSERT INTO skill_versions
      (skill_id, version, content_hash, arweave_tx_id, contributing_experience_ids, published_at)
      VALUES (?,?,?,?,?,?)`).run(
        skillId,
        currentVersion,
        Buffer.from(versionAcct.contentHash).toString("hex"),
        versionAcct.arweaveTxId,
        JSON.stringify(versionAcct.contributingExperienceIds.map(number)),
        number(versionAcct.publishedAt),
      );
    for (const account of shareAccounts) {
      db.prepare(`INSERT INTO share_accounts
        (holder, skill_id, contribution_weight, lock_until, first_contribution_at, last_contribution_at)
        VALUES (?,?,?,?,?,?)
        ON CONFLICT(holder, skill_id) DO UPDATE SET
          contribution_weight = excluded.contribution_weight,
          lock_until = excluded.lock_until,
          first_contribution_at = excluded.first_contribution_at,
          last_contribution_at = excluded.last_contribution_at`).run(
            account.holder.toBase58(),
            skillId,
            number(account.contributionWeight),
            number(account.lockUntil),
            number(account.firstContributionAt) || null,
            number(account.lastContributionAt) || null,
          );
    }
  })();
}

export async function hydrateSkillProjectionForTest(
  conn: Connection,
  db: DB,
  skillPk: PublicKey,
): Promise<void> {
  await hydrateSkillProjection(conn, db, skillPk);
}
