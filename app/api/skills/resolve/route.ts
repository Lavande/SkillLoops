import { NextRequest } from "next/server";
import { guarded } from "@/lib/api-helpers";
import { getDb } from "@/lib/db";
import { resolveSkillCandidates } from "@/lib/skills/resolve";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const body = await req.json().catch(() => ({}));
    const name = typeof body?.name === "string" ? body.name : "";
    const version = Number.isInteger(body?.version) && body.version > 0 ? body.version : undefined;
    const rows = getDb()
      .prepare(
        `SELECT skill_id, author, name, description, category, current_version, subscriber_count, created_at
         FROM skills`
      )
      .all() as any[];
    return resolveSkillCandidates(rows, { name, version });
  });
}
