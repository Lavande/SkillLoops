import { NextRequest } from "next/server";
import { z } from "zod";
import { guarded } from "@/lib/api-helpers";
import { tick } from "@/lib/indexer";

export const dynamic = "force-dynamic";

const Body = z.object({ sig: z.string().optional() });

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const body = Body.parse(await req.json().catch(() => ({})));
    const result = await tick({ sig: body.sig });
    return { processed: result.processed };
  });
}
