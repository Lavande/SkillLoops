import { NextRequest } from "next/server";
import { effectiveActor, guarded } from "@/lib/api-helpers";
import { ArweaveMock } from "@/lib/mock/arweave";
import { z } from "zod";

export const dynamic = "force-dynamic";

const Body = z.object({
  content: z.string().min(1),
  tags: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
});

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const owner = effectiveActor(req);
    const body = Body.parse(await req.json());
    return ArweaveMock.upload(body.content, body.tags ?? [], owner);
  });
}
