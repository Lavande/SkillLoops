import { describe, it, expect, beforeEach } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { _resetSingletonForTesting, getDb } from "@/lib/db";
import { applyEventForTest } from "@/lib/indexer";

const SKILL = new PublicKey("11111111111111111111111111111114");
const AUTHOR = new PublicKey("11111111111111111111111111111115");
const BOB = new PublicKey("11111111111111111111111111111116");

beforeEach(() => _resetSingletonForTesting());

describe("applyEvent projections (shape-only, no RPC fetch)", () => {
  it("SkillPublished creates skills row with placeholder metadata", async () => {
    const db = getDb(":memory:");
    await applyEventForTest(db, {
      name: "SkillPublished",
      data: { skill: SKILL, author: AUTHOR, createdAt: 100 },
    }, "sig1", 1, true);
    const row = db.prepare(`SELECT skill_id, name FROM skills WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(row).toBeTruthy();
    expect(row.name).toBe("<pending>");
  });

  it("Subscribed increments subscriber_count + total_revenue", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO skills (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(SKILL.toBase58(), AUTHOR.toBase58(), "Alice", "desc", "coding", 1, "h", "ar_x", 100_000_000, 4000, 100, 100);
    db.prepare(`INSERT INTO revenue_pools (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length) VALUES (?,0,0,100,300)`)
      .run(SKILL.toBase58());
    db.prepare(`INSERT INTO share_ledgers (skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time) VALUES (?,1000,1000,4000,0,100)`)
      .run(SKILL.toBase58());

    await applyEventForTest(db, {
      name: "Subscribed",
      data: { skill: SKILL, subscriber: BOB, expiryTime: 9999 },
    }, "sig2", 2, true);

    const skill = db.prepare(`SELECT subscriber_count, total_revenue FROM skills WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(skill.subscriber_count).toBe(1);
    expect(skill.total_revenue).toBe(100_000_000);
    const shareRow = db.prepare(`SELECT shares FROM share_accounts WHERE skill_id = ? AND holder = ?`).get(SKILL.toBase58(), BOB.toBase58()) as any;
    expect(shareRow?.shares).toBe(0);
  });

  it("SharesMinted updates total_shares + adds contributor", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO share_ledgers (skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time) VALUES (?,1000,1000,4000,0,100)`)
      .run(SKILL.toBase58());
    db.prepare(`INSERT INTO share_accounts (holder, skill_id, shares, lock_until, first_contribution_at, last_contribution_at) VALUES (?,?,0,0,NULL,NULL)`)
      .run(BOB.toBase58(), SKILL.toBase58());
    await applyEventForTest(db, {
      name: "SharesMinted",
      data: { skill: SKILL, holder: BOB, amount: 380, totalSharesAfter: 1380 },
    }, "sig3", 3, true);
    const ledger = db.prepare(`SELECT total_shares, contributor_count FROM share_ledgers WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(ledger.total_shares).toBe(1380);
    expect(ledger.contributor_count).toBe(1);
    const share = db.prepare(`SELECT shares FROM share_accounts WHERE holder = ? AND skill_id = ?`).get(BOB.toBase58(), SKILL.toBase58()) as any;
    expect(share.shares).toBe(380);
  });

  it("ExperienceSubmitted + ExperienceEvaluated update the experiences row", async () => {
    const db = getDb(":memory:");
    await applyEventForTest(db, {
      name: "ExperienceSubmitted",
      data: { skill: SKILL, experienceId: 0, contributor: BOB },
    }, "sig4", 4, true);
    const exp1 = db.prepare(`SELECT status FROM experiences WHERE skill_id = ? AND experience_id = ?`)
      .get(SKILL.toBase58(), 0) as any;
    expect(exp1.status).toBe("Pending");

    await applyEventForTest(db, {
      name: "ExperienceEvaluated",
      data: { skill: SKILL, experienceId: 0, score: 38, sharesMinted: 380, approved: true, floorHit: false },
    }, "sig5", 5, true);
    const exp2 = db.prepare(`SELECT status, contribution_score FROM experiences WHERE skill_id = ? AND experience_id = ?`)
      .get(SKILL.toBase58(), 0) as any;
    expect(exp2.status).toBe("Evaluated");
    expect(exp2.contribution_score).toBe(38);
  });

  it("PeriodSettled inserts revenue_history + advances pool", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO revenue_pools (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length) VALUES (?,300000000,0,100,300)`)
      .run(SKILL.toBase58());
    await applyEventForTest(db, {
      name: "PeriodSettled",
      data: { skill: SKILL, snapshotId: 1, periodRevenue: 300000000, totalShares: 1380 },
    }, "sig6", 6, true);
    const hist = db.prepare(`SELECT period_revenue, snapshot_total_shares FROM revenue_history WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(hist.period_revenue).toBe(300000000);
    expect(hist.snapshot_total_shares).toBe(1380);
  });

  it("RevenueClaimed zeros claimable row", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO claimable_revenue (holder, skill_id, amount, snapshot_id) VALUES (?,?,?,?)`)
      .run(BOB.toBase58(), SKILL.toBase58(), 27536231, 1);
    await applyEventForTest(db, {
      name: "RevenueClaimed",
      data: { skill: SKILL, holder: BOB, amount: 27536231, snapshotId: 1 },
    }, "sig7", 7, true);
    const row = db.prepare(`SELECT amount FROM claimable_revenue WHERE holder = ? AND skill_id = ? AND snapshot_id = 1`)
      .get(BOB.toBase58(), SKILL.toBase58()) as any;
    expect(row.amount).toBe(0);
  });

  it("VersionPublished updates skills.current_version", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO skills (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(SKILL.toBase58(), AUTHOR.toBase58(), "Alice", "d", "c", 1, "h", "ar_x", 100, 4000, 1, 1);
    await applyEventForTest(db, {
      name: "VersionPublished",
      data: { skill: SKILL, version: 2, contributingCount: 1 },
    }, "sig8", 8, true);
    const s = db.prepare(`SELECT current_version FROM skills WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(s.current_version).toBe(2);
  });

  it("re-applying same event is a no-op (idempotency)", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO share_ledgers (skill_id, total_shares, author_shares, min_author_ratio_bps, contributor_count, last_snapshot_time) VALUES (?,1000,1000,4000,0,0)`).run(SKILL.toBase58());
    db.prepare(`INSERT INTO share_accounts (holder, skill_id, shares, lock_until) VALUES (?,?,0,0)`).run(BOB.toBase58(), SKILL.toBase58());

    await applyEventForTest(db, {
      name: "SharesMinted",
      data: { skill: SKILL, holder: BOB, amount: 380, totalSharesAfter: 1380 },
    }, "dup", 9, true);
    db.prepare(`INSERT INTO indexed_signatures (signature, slot, status, processed_at) VALUES ('dup',9,'ok',0)`).run();
    await applyEventForTest(db, {
      name: "SharesMinted",
      data: { skill: SKILL, holder: BOB, amount: 380, totalSharesAfter: 1380 },
    }, "dup", 9, true);
    const ledger = db.prepare(`SELECT total_shares FROM share_ledgers WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(ledger.total_shares).toBe(1380);
  });
});
