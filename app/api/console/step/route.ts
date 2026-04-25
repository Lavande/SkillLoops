import { NextRequest } from "next/server";
import { guarded } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest) {
  return guarded(async () => ({ ok: true, stubbed: true, note: "rewritten in Task 23" }));
}
