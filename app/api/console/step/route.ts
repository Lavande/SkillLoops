import { NextRequest } from "next/server";
import { guarded } from "@/lib/api-helpers";

export const dynamic = "force-dynamic";

// All step actions are now client-side; the page calls the chain helpers
// directly with persona signers. This stub stays so old fetch URLs 404-free.
export async function POST(_req: NextRequest) {
  return guarded(async () => ({ ok: true, stubbed: true, note: "client-side stepper" }));
}
