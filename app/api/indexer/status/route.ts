import { NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { guarded } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { getConnection } from "@/lib/chain/connection";
import { getChainConfig } from "@/lib/chain/config";
import { getProgram } from "@/lib/chain/program";
import { pdas } from "@/lib/chain/pdas";
import { isRunning } from "@/lib/indexer";

export const dynamic = "force-dynamic";

function chainNumber(v: any): number {
  return Number(v?.toString?.() ?? v);
}

export async function GET(req: NextRequest) {
  return guarded(async () => {
    const db = getDb();
    const state = db.prepare(`SELECT last_seen_sig, last_seen_slot, updated_at FROM indexer_state WHERE id = 1`).get() as any;
    const parseFailures = (db.prepare(`SELECT COUNT(*) AS n FROM indexed_signatures WHERE status = 'parse_failed'`).get() as any)?.n ?? 0;
    const verify = req.nextUrl.searchParams.get("verify") === "1";
    const base = {
      running: isRunning(),
      lastSeenSig: state?.last_seen_sig ?? null,
      lastSeenSlot: state?.last_seen_slot ?? null,
      parseFailures,
    };
    if (!verify) return base;

    const conn = getConnection();
    const { programId } = getChainConfig();
    const program = getProgram(conn, {
      publicKey: new PublicKey("11111111111111111111111111111112"),
      signTransaction: async (t: any) => t,
    }, programId);
    const skills = db.prepare(`SELECT skill_id FROM skills ORDER BY RANDOM() LIMIT 5`).all() as { skill_id: string }[];
    const mismatches: any[] = [];
    for (const s of skills) {
      const [ledgerPda] = pdas.shareLedger(programId, new PublicKey(s.skill_id));
      const onChain = await (program.account as any).shareLedger.fetch(ledgerPda);
      const row = db.prepare(`SELECT author_ownership_bps, contributor_pool_bps, total_contributor_weight FROM share_ledgers WHERE skill_id = ?`).get(s.skill_id) as any;
      const chain = {
        authorOwnershipBps: chainNumber(onChain.authorOwnershipBps),
        contributorPoolBps: chainNumber(onChain.contributorPoolBps),
        totalContributorWeight: chainNumber(onChain.totalContributorWeight),
      };
      const dbSnapshot = {
        authorOwnershipBps: row.author_ownership_bps,
        contributorPoolBps: row.contributor_pool_bps,
        totalContributorWeight: row.total_contributor_weight,
      };
      if (
        dbSnapshot.authorOwnershipBps !== chain.authorOwnershipBps ||
        dbSnapshot.contributorPoolBps !== chain.contributorPoolBps ||
        dbSnapshot.totalContributorWeight !== chain.totalContributorWeight
      ) {
        mismatches.push({ skillId: s.skill_id, db: dbSnapshot, chain });
      }
    }
    return { ...base, ok: mismatches.length === 0, mismatches };
  });
}
