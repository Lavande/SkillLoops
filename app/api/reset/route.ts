import { ApiError, guarded } from "@/lib/api-helpers";
import { resetDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST() {
  return guarded(async () => {
    if (process.env.DEMO_MODE !== "true") throw new ApiError(403, "disabled_in_prod");
    resetDb();
    return { ok: true };
  });
}
