import { NextRequest } from "next/server";
import { guarded } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  return guarded(async () => {
    // Re-wired to call evaluateOnce() in Task 21 once the judge daemon ships.
    return { ok: true, stubbed: true, note: "rewired in Task 21" };
  });
}
