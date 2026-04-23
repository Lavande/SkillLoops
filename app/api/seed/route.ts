import { guarded } from "@/lib/api-helpers";
import { seedDemoIfEmpty } from "@/lib/seed/demo";

export const dynamic = "force-dynamic";

export async function POST() {
  return guarded(async () => seedDemoIfEmpty());
}
