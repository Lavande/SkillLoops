import { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, effectiveActor, guarded } from "@/lib/api-helpers";
import { LitMock } from "@/lib/mock/lit";

export const dynamic = "force-dynamic";

const Body = z.object({
  ciphertext: z.string(),
  skillId: z.string(),
});

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const caller = effectiveActor(req);
    const body = Body.parse(await req.json());
    const r = LitMock.decrypt(body.ciphertext, body.skillId, caller);
    if (!r.ok) throw new ApiError(403, r.reason);
    return { plaintext: r.plaintext };
  });
}
