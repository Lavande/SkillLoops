import { guarded } from "@/lib/api-helpers";
import { getJudgeRuntimeStatus } from "@/lib/judge-client";

export const dynamic = "force-dynamic";

export async function GET() {
  return guarded(async () => getJudgeRuntimeStatus());
}
