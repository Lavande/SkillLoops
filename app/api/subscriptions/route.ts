import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { effectiveActor, guarded } from "@/lib/api-helpers";
import { subscribe } from "@/lib/services";
import { SubscribeSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const body = SubscribeSchema.parse(await req.json());
    const actor = effectiveActor(req);
    return subscribe({ subscriber: actor, skillId: body.skill_id });
  });
}

export async function GET(req: NextRequest) {
  return guarded(async () => {
    const url = req.nextUrl;
    const holder = url.searchParams.get("holder") ?? req.headers.get("x-slp-wallet");
    if (!holder) return [];
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT su.*, s.name, s.category, s.subscription_price, s.current_version FROM subscriptions su JOIN skills s ON s.skill_id = su.skill_id WHERE su.subscriber = ? ORDER BY su.start_time DESC`
      )
      .all(holder) as any[];
    return rows.map((r) => ({
      skillId: r.skill_id,
      name: r.name,
      category: r.category,
      subscriptionPrice: r.subscription_price,
      currentVersion: r.current_version,
      startTime: r.start_time,
      expiryTime: r.expiry_time,
      isActive: !!r.is_active,
    }));
  });
}
