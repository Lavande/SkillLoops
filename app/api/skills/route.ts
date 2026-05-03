import { NextRequest } from "next/server";
import { getDb } from "@/lib/db";
import { guarded, ownershipPct } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return guarded(async () => {
    const url = req.nextUrl;
    const category = url.searchParams.get("category");
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const sort = url.searchParams.get("sort") ?? "subscribers";
    const db = getDb();
    let rows = db
      .prepare(
        `SELECT s.*, l.author_ownership_bps, l.contributor_pool_bps, l.contributor_count
         FROM skills s JOIN share_ledgers l ON l.skill_id = s.skill_id`
      )
      .all() as any[];
    if (category) rows = rows.filter((r) => r.category === category);
    if (q) rows = rows.filter((r) => r.name.toLowerCase().includes(q) || r.description.toLowerCase().includes(q));
    rows.sort((a, b) => {
      switch (sort) {
        case "holders":
          return b.contributor_count - a.contributor_count;
        case "recent":
          return b.created_at - a.created_at;
        case "price":
          return a.subscription_price - b.subscription_price;
        default:
          return b.subscriber_count - a.subscriber_count;
      }
    });
    return rows.map(shape);
  });
}

function shape(r: any) {
  return {
    skillId: r.skill_id,
    author: r.author,
    name: r.name,
    description: r.description,
    category: r.category,
    currentVersion: r.current_version,
    subscriptionPrice: r.subscription_price,
    minAuthorRatioBps: r.min_author_ratio_bps,
    createdAt: r.created_at,
    subscriberCount: r.subscriber_count,
    totalRevenue: r.total_revenue,
    authorOwnershipBps: r.author_ownership_bps,
    authorOwnershipPct: ownershipPct(r.author_ownership_bps),
    contributorPoolBps: r.contributor_pool_bps,
    contributorPoolPct: ownershipPct(r.contributor_pool_bps),
    contributorCount: r.contributor_count,
  };
}
