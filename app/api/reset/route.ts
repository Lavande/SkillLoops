import { ApiError, guarded } from "@/lib/api-helpers";
import { getDb, resetDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  return guarded(async () => {
    if (process.env.DEMO_MODE !== "true") throw new ApiError(403, "disabled_in_prod");
    // Explicitly clear indexer bookkeeping so the next tick re-projects from
    // genesis. resetDb() already nukes the file but we keep these DELETEs
    // documenting the contract: a reset wipes indexer_state + indexed_signatures.
    try {
      const db = getDb();
      db.exec(`DELETE FROM indexer_state; DELETE FROM indexed_signatures;`);
    } catch {
      // First-time reset has no DB yet — fine, resetDb() handles it.
    }
    resetDb();
    return { ok: true };
  });
}
