import { describe, it, expect, beforeEach, vi } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { _resetSingletonForTesting, getDb } from "@/lib/db";
import { applyEventForTest, enrichAfterCommitForTest } from "@/lib/indexer";

const programMock = vi.hoisted(() => ({
  experienceFetch: vi.fn(),
  skillFetch: vi.fn(),
}));

vi.mock("@/lib/chain/program", () => ({
  getProgram: () => ({
    account: {
      skill: { fetch: programMock.skillFetch },
      experienceRecord: { fetch: programMock.experienceFetch },
      claimableRevenue: { all: vi.fn().mockResolvedValue([]) },
    },
  }),
}));

const SKILL = new PublicKey("11111111111111111111111111111114");
const OTHER_SKILL = new PublicKey("11111111111111111111111111111117");
const AUTHOR = new PublicKey("11111111111111111111111111111115");
const BOB = new PublicKey("11111111111111111111111111111116");

beforeEach(() => {
  _resetSingletonForTesting();
  programMock.experienceFetch.mockReset();
  programMock.skillFetch.mockReset();
});

function insertOwnershipLedger(db: ReturnType<typeof getDb>) {
  db.prepare(`INSERT INTO share_ledgers
    (skill_id, author_ownership_bps, contributor_pool_bps, min_author_ratio_bps, total_contributor_weight, contributor_count, points_per_100bps, max_pool_increase_per_evaluation_bps, last_snapshot_time)
    VALUES (?,10000,0,4000,0,0,250,500,100)`).run(SKILL.toBase58());
}

describe("applyEvent projections (shape-only, no RPC fetch)", () => {
  it("SkillPublished creates placeholder skill, ownership ledger, author account, pool, and v1", async () => {
    const db = getDb(":memory:");
    await applyEventForTest(db, {
      name: "SkillPublished",
      data: { skill: SKILL, author: AUTHOR, createdAt: 100 },
    }, "sig1", 1, true);

    const skill = db.prepare(`SELECT skill_id, name FROM skills WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(skill.name).toBe("<pending>");
    const ledger = db.prepare(`SELECT author_ownership_bps, contributor_pool_bps, total_contributor_weight FROM share_ledgers WHERE skill_id = ?`)
      .get(SKILL.toBase58()) as any;
    expect(ledger).toMatchObject({ author_ownership_bps: 10000, contributor_pool_bps: 0, total_contributor_weight: 0 });
    const authorShare = db.prepare(`SELECT contribution_weight FROM share_accounts WHERE skill_id = ? AND holder = ?`)
      .get(SKILL.toBase58(), AUTHOR.toBase58()) as any;
    expect(authorShare.contribution_weight).toBe(0);
  });

  it("Subscribed increments subscriber_count + total_revenue and creates zero-weight account", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO skills (skill_id, author, name, description, category, current_version, content_hash, arweave_tx_id, subscription_price, min_author_ratio_bps, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(SKILL.toBase58(), AUTHOR.toBase58(), "Alice", "desc", "coding", 1, "h", "ar_x", 100_000_000, 4000, 100, 100);
    db.prepare(`INSERT INTO revenue_pools (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length) VALUES (?,0,0,100,300)`)
      .run(SKILL.toBase58());
    insertOwnershipLedger(db);

    await applyEventForTest(db, {
      name: "Subscribed",
      data: { skill: SKILL, subscriber: BOB, expiryTime: 9999 },
    }, "sig2", 2, true);

    const skill = db.prepare(`SELECT subscriber_count, total_revenue FROM skills WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(skill.subscriber_count).toBe(1);
    expect(skill.total_revenue).toBe(100_000_000);
    const shareRow = db.prepare(`SELECT contribution_weight FROM share_accounts WHERE skill_id = ? AND holder = ?`).get(SKILL.toBase58(), BOB.toBase58()) as any;
    expect(shareRow.contribution_weight).toBe(0);
  });

  it("ExperienceSubmitted + ExperienceEvaluated update experience, ledger, and contributor weight", async () => {
    const db = getDb(":memory:");
    insertOwnershipLedger(db);
    await applyEventForTest(db, {
      name: "ExperienceSubmitted",
      data: { skill: SKILL, experienceId: 0, contributor: BOB },
    }, "sig4", 4, true);

    await applyEventForTest(db, {
      name: "ExperienceEvaluated",
      data: {
        skill: SKILL,
        experienceId: 0,
        contributor: BOB,
        score: 38,
        contributionWeightDelta: 95,
        ownershipDeltaBps: 0,
        authorOwnershipBps: 10000,
        contributorPoolBps: 0,
        approved: true,
      },
    }, "sig5", 5, true);

    const exp = db.prepare(`SELECT status, contribution_score, contribution_weight_delta, ownership_delta_bps FROM experiences WHERE skill_id = ? AND experience_id = ?`)
      .get(SKILL.toBase58(), 0) as any;
    expect(exp).toMatchObject({ status: "Evaluated", contribution_score: 38, contribution_weight_delta: 95, ownership_delta_bps: 0 });
    const ledger = db.prepare(`SELECT author_ownership_bps, contributor_pool_bps, total_contributor_weight, contributor_count FROM share_ledgers WHERE skill_id = ?`)
      .get(SKILL.toBase58()) as any;
    expect(ledger).toMatchObject({ author_ownership_bps: 10000, contributor_pool_bps: 0, total_contributor_weight: 95, contributor_count: 1 });
    const share = db.prepare(`SELECT contribution_weight FROM share_accounts WHERE holder = ? AND skill_id = ?`)
      .get(BOB.toBase58(), SKILL.toBase58()) as any;
    expect(share.contribution_weight).toBe(95);
  });

  it("does not double-apply an already indexed evaluation event", async () => {
    const db = getDb(":memory:");
    insertOwnershipLedger(db);
    db.prepare(`INSERT INTO share_accounts (holder, skill_id, contribution_weight, lock_until) VALUES (?,?,0,0)`)
      .run(BOB.toBase58(), SKILL.toBase58());
    const ev = {
      name: "ExperienceEvaluated" as const,
      data: {
        skill: SKILL,
        experienceId: 0,
        contributor: BOB,
        score: 38,
        contributionWeightDelta: 95,
        ownershipDeltaBps: 0,
        authorOwnershipBps: 10000,
        contributorPoolBps: 0,
        approved: true,
      },
    };

    await applyEventForTest(db, ev, "dup", 9, true);
    db.prepare(`INSERT OR IGNORE INTO indexed_signatures (signature, slot, status, processed_at) VALUES ('dup',9,'ok',0)`).run();
    await applyEventForTest(db, ev, "dup", 9, true);

    const ledger = db.prepare(`SELECT total_contributor_weight FROM share_ledgers WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(ledger.total_contributor_weight).toBe(95);
  });

  it("allows the same chain experience id under different skills", async () => {
    const db = getDb(":memory:");

    await applyEventForTest(db, {
      name: "ExperienceSubmitted",
      data: { skill: SKILL, experienceId: 0, contributor: BOB },
    }, "sig4-skill-a", 4, true);
    await applyEventForTest(db, {
      name: "ExperienceSubmitted",
      data: { skill: OTHER_SKILL, experienceId: 0, contributor: BOB },
    }, "sig4-skill-b", 5, true);

    const rows = db.prepare(`SELECT skill_id, experience_id FROM experiences WHERE experience_id = 0`).all() as any[];
    expect(rows).toHaveLength(2);
  });

  it("ExperienceSubmitted enrichment backfills bundle pointer fields from the on-chain account", async () => {
    const db = getDb(":memory:");
    const ev = {
      name: "ExperienceSubmitted" as const,
      data: { skill: SKILL, experienceId: 0, contributor: BOB },
    };
    await applyEventForTest(db, ev, "sig4b", 4, true);
    programMock.experienceFetch.mockResolvedValueOnce({
      skillVersion: 2,
      contentHash: Uint8Array.from({ length: 32 }, (_v, i) => i),
      arweaveTxId: "irys_bundle_tx",
      submittedAt: { toString: () => "1234" },
    });
    process.env.NEXT_PUBLIC_SLP_PROGRAM_ID = "5uTb4ZPTVB1HFMdTeBXELPzgaX2dcVRZoxPQW2SNzQAH";

    await enrichAfterCommitForTest({} as any, db, ev);

    const exp = db.prepare(`SELECT skill_version, content_hash, arweave_tx_id, submitted_at FROM experiences WHERE skill_id = ? AND experience_id = ?`)
      .get(SKILL.toBase58(), 0) as any;
    expect(exp.skill_version).toBe(2);
    expect(exp.content_hash).toBe("000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    expect(exp.arweave_tx_id).toBe("irys_bundle_tx");
    expect(exp.submitted_at).toBe(1234);
  });

  it("SkillPublished enrichment backfills the ledger author floor from the on-chain skill", async () => {
    const db = getDb(":memory:");
    const ev = {
      name: "SkillPublished" as const,
      data: { skill: SKILL, author: AUTHOR, createdAt: 100 },
    };
    await applyEventForTest(db, ev, "sig-skill-enrich", 4, true);
    programMock.skillFetch.mockResolvedValueOnce({
      name: "Alice",
      description: "desc",
      category: "coding",
      contentHash: Uint8Array.from({ length: 32 }, (_v, i) => i),
      arweaveTxId: "irys_skill_tx",
      subscriptionPrice: { toString: () => "100000000" },
      minAuthorRatioBps: 4000,
    });
    process.env.NEXT_PUBLIC_SLP_PROGRAM_ID = "5uTb4ZPTVB1HFMdTeBXELPzgaX2dcVRZoxPQW2SNzQAH";

    await enrichAfterCommitForTest({} as any, db, ev);

    const ledger = db.prepare(`SELECT min_author_ratio_bps FROM share_ledgers WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(ledger.min_author_ratio_bps).toBe(4000);
  });

  it("ExperienceEvaluated enrichment backfills judge report fields from the on-chain account", async () => {
    const db = getDb(":memory:");
    insertOwnershipLedger(db);
    const submitted = {
      name: "ExperienceSubmitted" as const,
      data: { skill: SKILL, experienceId: 0, contributor: BOB },
    };
    await applyEventForTest(db, submitted, "sig4c", 4, true);
    const evaluated = {
      name: "ExperienceEvaluated" as const,
      data: {
        skill: SKILL,
        experienceId: 0,
        contributor: BOB,
        score: 42,
        contributionWeightDelta: 105,
        ownershipDeltaBps: 0,
        authorOwnershipBps: 10000,
        contributorPoolBps: 0,
        approved: true,
      },
    };
    await applyEventForTest(db, evaluated, "sig5c", 5, true);
    programMock.experienceFetch.mockResolvedValueOnce({
      contributionWeightDelta: { toString: () => "105" },
      ownershipDeltaBps: 0,
      evaluatedAt: { toString: () => "5678" },
      judgeReportTxId: "irys_judge_report_tx",
    });
    process.env.NEXT_PUBLIC_SLP_PROGRAM_ID = "5uTb4ZPTVB1HFMdTeBXELPzgaX2dcVRZoxPQW2SNzQAH";

    await enrichAfterCommitForTest({} as any, db, evaluated);

    const exp = db.prepare(`SELECT contribution_weight_delta, ownership_delta_bps, evaluated_at, judge_report_tx_id FROM experiences WHERE skill_id = ? AND experience_id = ?`)
      .get(SKILL.toBase58(), 0) as any;
    expect(exp.contribution_weight_delta).toBe(105);
    expect(exp.ownership_delta_bps).toBe(0);
    expect(exp.evaluated_at).toBe(5678);
    expect(exp.judge_report_tx_id).toBe("irys_judge_report_tx");
  });

  it("PeriodSettled inserts revenue_history + advances pool", async () => {
    const db = getDb(":memory:");
    db.prepare(`INSERT INTO revenue_pools (skill_id, current_period_revenue, total_lifetime_revenue, current_period_start, period_length) VALUES (?,300000000,0,100,300)`)
      .run(SKILL.toBase58());
    await applyEventForTest(db, {
      name: "PeriodSettled",
      data: { skill: SKILL, snapshotId: 1, periodRevenue: 300000000, authorOwnershipBps: 10000, contributorPoolBps: 0 },
    }, "sig6", 6, true);
    const hist = db.prepare(`SELECT period_revenue, snapshot_author_ownership_bps, snapshot_contributor_pool_bps FROM revenue_history WHERE skill_id = ?`).get(SKILL.toBase58()) as any;
    expect(hist.period_revenue).toBe(300000000);
    expect(hist.snapshot_author_ownership_bps).toBe(10000);
    expect(hist.snapshot_contributor_pool_bps).toBe(0);
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
});
