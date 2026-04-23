import { NextRequest } from "next/server";
import { effectiveActor, guarded } from "@/lib/api-helpers";
import { claimRevenue } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { skillId: string } }) {
  return guarded(async () => {
    const holder = effectiveActor(req);
    return claimRevenue({ skillId: params.skillId, holder });
  });
}
