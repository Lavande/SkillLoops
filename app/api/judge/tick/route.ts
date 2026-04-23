import { NextRequest } from "next/server";
import { guarded } from "@/lib/api-helpers";
import { evaluatePending } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  return guarded(async () => {
    evaluatePending();
    return { ok: true };
  });
}
