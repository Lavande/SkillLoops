import { NextRequest } from "next/server";
import { guarded } from "@/lib/api-helpers";
import { evaluateOnce } from "@/lib/judge-client";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  return guarded(async () => {
    const result = await evaluateOnce();
    return { processed: result.processed };
  });
}
