import crypto from "node:crypto";
import { getDb } from "./db";
import { ArweaveMock } from "./mock/arweave";
import { LitMock } from "./mock/lit";
import { scoreBundle, JUDGE_ID } from "./mock/judge";
import { mintContributionShares } from "./domain/shares";
import { computeClaims, settlePeriod } from "./domain/revenue";
import { INITIAL_TOTAL_SHARES, LAMPORTS_PER_SOL } from "./domain/thresholds";
import { now } from "./mock/clock";
import { ApiError, genId } from "./api-helpers";
import type { ExperienceBundle } from "./schemas";

export function sha256Hex(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

/* ======== skills + versions ======== */

export interface PublishSkillInput {
  author: string;
  name: string;
  description: string;
  category: string;
  content: string; // SKILL.md plaintext
  subscriptionPriceLamports: number;
  minAuthorRatioBps: number;
  periodLengthSeconds: number;
}

export function publishSkill(input: PublishSkillInput) {
  const db = getDb();
  const skillId = genId("skill");
  const { ciphertext } = LitMock.encrypt(input.content, skillId);
  const { txId } = ArweaveMock.upload(ciphertext, [
    { name: "Protocol", value: "SLP" },
    { name: "Type", value: "SkillContent" },
    { name: "SkillId", value: skillId },
  ], input.author);
  const hash = sha256Hex(input.content);
  const t = now();

  db.prepare(
    `INSERT INTO skills (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at, subscriber_count, total_revenue) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    skillId,
    input.author,
    input.name,
    input.description,
    input.category,
    1,
    hash,
    txId,
    input.subscriptionPriceLamports,
    input.minAuthorRatioBps,
    t,
    t,
    0,
    0
  );
  db.prepare(
    `INSERT INTO skill_versions (skill_id, version, content_hash, arweave_tx_id, contributing_experience_ids, published_at) VALUES (?,?,?,?,?,?)`
  ).run(skillId, 1, hash, txId, JSON.stringify([]), t);
  db.prepare(
    `INSERT INTO share_ledgers (skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time) VALUES (?,?,?,?,?,?)`
  ).run(skillId, INITIAL_TOTAL_SHARES, INITIAL_TOTAL_SHARES, input.minAuthorRatioBps, 0, t);
  db.prepare(
    `INSERT OR IGNORE INTO share_accounts (holder, skill_id, shares, lock_until, first_contribution_at, last_contribution_at) VALUES (?,?,?,?,?,?)`
  ).run(input.author, skillId, INITIAL_TOTAL_SHARES, 0, null, null);
  db.prepare(
    `INSERT INTO revenue_pools (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length, snapshot_total_shares, last_settlement_time) VALUES (?,?,?,?,?,?,?)`
  ).run(skillId, 0, 0, t, input.periodLengthSeconds, 0, 0);

  return { skillId, arweaveTxId: txId };
}

export function publishNewVersion(args: {
  skillId: string;
  caller: string;
  content: string;
  contributingExperienceIds: number[];
}) {
  const db = getDb();
  const skill = db.prepare(`SELECT * FROM skills WHERE skill_id = ?`).get(args.skillId) as any;
  if (!skill) throw new ApiError(404, "skill_not_found");
  if (skill.author !== args.caller) throw new ApiError(403, "only_author_may_publish_version");
  const nextVersion = (skill.current_version as number) + 1;
  const { ciphertext } = LitMock.encrypt(args.content, args.skillId);
  const { txId } = ArweaveMock.upload(ciphertext, [
    { name: "Protocol", value: "SLP" },
    { name: "Type", value: "SkillContent" },
    { name: "SkillId", value: args.skillId },
    { name: "Version", value: String(nextVersion) },
  ], args.caller);
  const hash = sha256Hex(args.content);
  const t = now();
  db.prepare(
    `INSERT INTO skill_versions (skill_id, version, content_hash, arweave_tx_id, contributing_experience_ids, published_at) VALUES (?,?,?,?,?,?)`
  ).run(args.skillId, nextVersion, hash, txId, JSON.stringify(args.contributingExperienceIds), t);
  db.prepare(
    `UPDATE skills SET current_version = ?, content_hash = ?, arweave_tx_id = ?, updated_at = ? WHERE skill_id = ?`
  ).run(nextVersion, hash, txId, t, args.skillId);
  return { version: nextVersion, arweaveTxId: txId };
}

/* ======== subscriptions ======== */

export function subscribe(args: { subscriber: string; skillId: string; thirtyDays?: number }) {
  const db = getDb();
  const skill = db.prepare(`SELECT * FROM skills WHERE skill_id = ?`).get(args.skillId) as any;
  if (!skill) throw new ApiError(404, "skill_not_found");
  const existing = db
    .prepare(`SELECT * FROM subscriptions WHERE subscriber = ? AND skill_id = ?`)
    .get(args.subscriber, args.skillId) as any;
  const t = now();
  const duration = args.thirtyDays ?? 60 * 60 * 24 * 30;
  const expiry = t + duration;

  const tx = db.transaction(() => {
    if (!existing) {
      db.prepare(
        `INSERT INTO subscriptions (subscriber, skill_id, start_time, expiry_time, total_calls, is_active) VALUES (?,?,?,?,?,?)`
      ).run(args.subscriber, args.skillId, t, expiry, 0, 1);
      db.prepare(`UPDATE skills SET subscriber_count = subscriber_count + 1 WHERE skill_id = ?`).run(args.skillId);
    } else {
      db.prepare(
        `UPDATE subscriptions SET start_time = ?, expiry_time = ?, is_active = 1 WHERE subscriber = ? AND skill_id = ?`
      ).run(t, expiry, args.subscriber, args.skillId);
    }
    db.prepare(
      `INSERT OR IGNORE INTO share_accounts (holder, skill_id, shares, lock_until, first_contribution_at, last_contribution_at) VALUES (?,?,?,?,?,?)`
    ).run(args.subscriber, args.skillId, 0, 0, null, null);
    db.prepare(`UPDATE skills SET total_revenue = total_revenue + ? WHERE skill_id = ?`).run(
      skill.subscription_price,
      args.skillId
    );
    db.prepare(
      `UPDATE revenue_pools SET current_period_revenue = current_period_revenue + ? WHERE skill_id = ?`
    ).run(skill.subscription_price, args.skillId);
  });
  tx();

  return { expiry, priceLamports: skill.subscription_price };
}

/* ======== experiences + judge ======== */

export function submitExperience(args: {
  contributor: string;
  skillId: string;
  arweaveTxId: string;
  bundleJson: string;
}) {
  const db = getDb();
  const skill = db.prepare(`SELECT * FROM skills WHERE skill_id = ?`).get(args.skillId) as any;
  if (!skill) throw new ApiError(404, "skill_not_found");
  const sub = db
    .prepare(`SELECT * FROM subscriptions WHERE subscriber = ? AND skill_id = ? AND is_active = 1`)
    .get(args.contributor, args.skillId) as any;
  if (!sub) throw new ApiError(403, "subscription_required");
  const hash = sha256Hex(args.bundleJson);
  const parsed = JSON.parse(args.bundleJson);
  const r = db
    .prepare(
      `INSERT INTO experiences (skill_id, contributor, skill_version, content_hash, arweave_tx_id, bundle_json, status, submitted_at) VALUES (?,?,?,?,?,?, 'Pending', ?)`
    )
    .run(
      args.skillId,
      args.contributor,
      parsed.skill_version ?? skill.current_version,
      hash,
      args.arweaveTxId,
      args.bundleJson,
      now()
    );
  const experienceId = Number(r.lastInsertRowid);
  return { experienceId };
}

export function evaluatePending(experienceId?: number) {
  const db = getDb();
  const rows = experienceId
    ? db.prepare(`SELECT * FROM experiences WHERE experience_id = ? AND status = 'Pending'`).all(experienceId)
    : db.prepare(`SELECT * FROM experiences WHERE status = 'Pending'`).all();
  for (const row of rows as any[]) {
    const bundle = JSON.parse(row.bundle_json) as ExperienceBundle;
    const priors = db
      .prepare(`SELECT bundle_json FROM experiences WHERE skill_id = ? AND experience_id != ? AND status = 'Evaluated'`)
      .all(row.skill_id, row.experience_id) as { bundle_json: string }[];
    const priorBundles = priors.map((p) => JSON.parse(p.bundle_json) as ExperienceBundle);

    const report = scoreBundle(bundle, priorBundles);
    report.experience_id = row.experience_id;

    const ledger = db.prepare(`SELECT * FROM share_ledgers WHERE skill_id = ?`).get(row.skill_id) as any;
    const existingAccount = db
      .prepare(`SELECT shares FROM share_accounts WHERE holder = ? AND skill_id = ?`)
      .get(row.contributor, row.skill_id) as any;
    const contributorIsNew = !existingAccount || (existingAccount.shares ?? 0) === 0;

    const mint = mintContributionShares({
      score: report.weighted_total,
      ledger: {
        total_shares: ledger.total_shares,
        author_shares: ledger.author_shares,
        min_author_ratio_bps: ledger.min_author_ratio_bps,
        contributor_count: ledger.contributor_count,
      },
      contributorIsNew,
    });

    const reportTx = ArweaveMock.upload(
      JSON.stringify(report, null, 2),
      [
        { name: "Protocol", value: "SLP" },
        { name: "Type", value: "JudgeReport" },
        { name: "ExperienceId", value: String(row.experience_id) },
      ],
      JUDGE_ID
    );

    const t = now();
    const tx = db.transaction(() => {
      if (mint.sharesToMint > 0) {
        db.prepare(
          `UPDATE share_ledgers SET total_shares = ?, contributor_count = ? WHERE skill_id = ?`
        ).run(mint.newLedger.total_shares, mint.newLedger.contributor_count, row.skill_id);
        db.prepare(
          `INSERT INTO share_accounts (holder, skill_id, shares, lock_until, first_contribution_at, last_contribution_at) VALUES (?,?,?,?,?,?)
           ON CONFLICT(holder, skill_id) DO UPDATE SET shares = shares + excluded.shares, last_contribution_at = excluded.last_contribution_at, first_contribution_at = COALESCE(share_accounts.first_contribution_at, excluded.first_contribution_at), lock_until = excluded.lock_until`
        ).run(row.contributor, row.skill_id, mint.sharesToMint, t + 60 * 60 * 24 * 180, t, t);
      }
      const newStatus = mint.sharesToMint > 0 ? "Evaluated" : "Rejected";
      db.prepare(
        `UPDATE experiences SET status = ?, contribution_score = ?, shares_minted = ?, evaluated_at = ?, judge_report_tx_id = ?, judge_report_json = ? WHERE experience_id = ?`
      ).run(
        newStatus,
        report.weighted_total,
        mint.sharesToMint,
        t,
        reportTx.txId,
        JSON.stringify(report),
        row.experience_id
      );
    });
    tx();
  }
}

/* ======== revenue ======== */

export function settleRevenue(args: { skillId: string }) {
  const db = getDb();
  const pool = db.prepare(`SELECT * FROM revenue_pools WHERE skill_id = ?`).get(args.skillId) as any;
  if (!pool) throw new ApiError(404, "pool_not_found");
  const ledger = db.prepare(`SELECT total_shares FROM share_ledgers WHERE skill_id = ?`).get(args.skillId) as any;
  const result = settlePeriod({
    pool,
    totalShares: ledger.total_shares,
    now: now(),
  });
  if (!result.canSettle) throw new ApiError(409, result.reason ?? "cannot_settle");
  const holders = db
    .prepare(`SELECT holder, shares FROM share_accounts WHERE skill_id = ?`)
    .all(args.skillId) as { holder: string; shares: number }[];
  const claims = computeClaims({
    holders,
    periodRevenue: result.periodRevenue,
    totalShares: result.snapshotTotalShares,
  });
  const historyId = db
    .prepare(
      `INSERT INTO revenue_history (skill_id, period_start, period_end, period_revenue, snapshot_total_shares) VALUES (?,?,?,?,?)`
    )
    .run(args.skillId, pool.current_period_start, now(), result.periodRevenue, result.snapshotTotalShares).lastInsertRowid;
  const snapshotId = Number(historyId);
  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE revenue_pools SET current_period_revenue = ?, total_lifetime_revenue = ?, current_period_start = ?, snapshot_total_shares = ?, last_settlement_time = ? WHERE skill_id = ?`
    ).run(
      0,
      result.newPool.total_lifetime_revenue,
      result.newPool.current_period_start,
      result.newPool.snapshot_total_shares,
      result.newPool.last_settlement_time,
      args.skillId
    );
    for (const claim of claims) {
      if (claim.amount <= 0) continue;
      db.prepare(
        `INSERT INTO claimable_revenue (holder, skill_id, amount, snapshot_id) VALUES (?,?,?,?)
         ON CONFLICT(holder, skill_id, snapshot_id) DO UPDATE SET amount = amount + excluded.amount`
      ).run(claim.holder, args.skillId, claim.amount, snapshotId);
    }
  });
  tx();
  return { snapshotId, claims, periodRevenue: result.periodRevenue };
}

export function claimRevenue(args: { skillId: string; holder: string }) {
  const db = getDb();
  const rows = db
    .prepare(`SELECT amount, snapshot_id FROM claimable_revenue WHERE holder = ? AND skill_id = ? AND amount > 0`)
    .all(args.holder, args.skillId) as { amount: number; snapshot_id: number }[];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (total === 0) throw new ApiError(400, "nothing_claimable");
  const tx = db.transaction(() => {
    db.prepare(`UPDATE claimable_revenue SET amount = 0 WHERE holder = ? AND skill_id = ?`).run(args.holder, args.skillId);
    db.prepare(
      `INSERT INTO balances (holder, lamports) VALUES (?, ?) ON CONFLICT(holder) DO UPDATE SET lamports = lamports + excluded.lamports`
    ).run(args.holder, total);
  });
  tx();
  return { claimed: total };
}

/* ======== helpers ======== */

export function getSolBalance(holder: string): number {
  const db = getDb();
  const row = db.prepare(`SELECT lamports FROM balances WHERE holder = ?`).get(holder) as { lamports: number } | undefined;
  return row?.lamports ?? 0;
}

export function getPeriodLengthSeconds(): number {
  const raw = Number(process.env.NEXT_PUBLIC_PERIOD_LENGTH_SECONDS ?? "300");
  if (!Number.isFinite(raw) || raw <= 0) return 300;
  return raw;
}

export const SOL = LAMPORTS_PER_SOL;
