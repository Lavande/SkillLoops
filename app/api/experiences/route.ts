import { NextRequest } from "next/server";
import { effectiveActor, guarded } from "@/lib/api-helpers";
import { submitExperience, evaluatePending } from "@/lib/services";
import { ExperienceBundleSchema, SubmitExperienceSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return guarded(async () => {
    const body = SubmitExperienceSchema.parse(await req.json());
    // also validate bundle shape
    const bundle = ExperienceBundleSchema.parse(JSON.parse(body.bundle_json));
    const actor = effectiveActor(req);
    const result = submitExperience({
      contributor: actor,
      skillId: body.skill_id,
      arweaveTxId: body.arweave_tx_id,
      bundleJson: JSON.stringify(bundle),
    });
    // Best-effort in-process evaluate after 3s.
    setTimeout(() => {
      try {
        evaluatePending(result.experienceId);
      } catch (e) {
        console.error("evaluatePending error", e);
      }
    }, 3000);
    return result;
  });
}
