import { NextRequest } from "next/server";
import { effectiveActor, guarded } from "@/lib/api-helpers";
import { publishNewVersion } from "@/lib/services";
import { PublishVersionSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return guarded(async () => {
    const body = PublishVersionSchema.parse(await req.json());
    const caller = effectiveActor(req);
    return publishNewVersion({
      skillId: params.id,
      caller,
      content: body.content,
      contributingExperienceIds: body.contributing_experience_ids,
    });
  });
}
