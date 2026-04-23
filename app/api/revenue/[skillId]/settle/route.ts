import { NextRequest } from "next/server";
import { guarded } from "@/lib/api-helpers";
import { settleRevenue } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: { skillId: string } }) {
  return guarded(async () => settleRevenue({ skillId: params.skillId }));
}
