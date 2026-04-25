import { getDb } from "@/lib/db";
import { getConnection } from "./chain/connection";
import { getChainConfig } from "./chain/config";
import { evaluateExperience } from "./chain/tx";
import { ArweaveMock } from "./mock/arweave";
import { scoreBundle, JUDGE_ID } from "./mock/judge";
import { loadPersonaSigners } from "./personas";
import type { ExperienceBundle } from "./schemas";
import { PublicKey } from "@solana/web3.js";

let running = false;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

export function isJudgeRunning(): boolean { return running; }

export function startJudgeDaemon(): void {
  if (intervalHandle) return;
  running = true;
  intervalHandle = setInterval(() => { evaluateOnce().catch((e) => console.error("[judge]", e)); }, 3000);
}

export function stopJudgeDaemon(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  running = false;
}

export async function evaluateOnce(): Promise<{ processed: number }> {
  const db = getDb();
  const signers = loadPersonaSigners();
  if (!signers) return { processed: 0 };
  const conn = getConnection();
  const { programId } = getChainConfig();

  const pending = db.prepare(`SELECT experience_id, skill_id, bundle_json, contributor, arweave_tx_id
                              FROM experiences
                              WHERE status = 'Pending'
                              ORDER BY submitted_at ASC LIMIT 5`).all() as any[];
  let processed = 0;
  for (const row of pending) {
    let bundle: ExperienceBundle | null = null;
    if (row.bundle_json) {
      try { bundle = JSON.parse(row.bundle_json); } catch {}
    }
    if (!bundle) {
      const obj = row.arweave_tx_id ? ArweaveMock.fetch(row.arweave_tx_id) : null;
      if (obj?.content) {
        try { bundle = JSON.parse(obj.content); } catch {}
        if (bundle) db.prepare(`UPDATE experiences SET bundle_json = ? WHERE experience_id = ? AND skill_id = ?`)
          .run(JSON.stringify(bundle), row.experience_id, row.skill_id);
      }
    }
    if (!bundle) continue;

    const priors = db.prepare(`SELECT bundle_json FROM experiences WHERE skill_id = ? AND status = 'Evaluated' AND experience_id != ?`)
      .all(row.skill_id, row.experience_id) as any[];
    const priorBundles = priors
      .map((p) => { try { return JSON.parse(p.bundle_json); } catch { return null; } })
      .filter(Boolean);
    const report = scoreBundle(bundle, priorBundles);
    report.experience_id = row.experience_id;

    const reportUp = ArweaveMock.upload(JSON.stringify(report, null, 2),
      [{ name: "Protocol", value: "SLP" }, { name: "Type", value: "JudgeReport" }, { name: "ExperienceId", value: String(row.experience_id) }],
      JUDGE_ID);

    try {
      await evaluateExperience(conn, signers.judge, {
        programId,
        skill: new PublicKey(row.skill_id),
        experienceId: BigInt(row.experience_id),
        contributor: new PublicKey(row.contributor),
        score: report.weighted_total,
        judgeReportTxId: reportUp.txId,
      });
      processed += 1;
    } catch (e) {
      console.error("[judge] evaluate failed:", (e as Error).message);
    }
  }
  return { processed };
}
