import { NextRequest } from "next/server";
import { ApiError, guarded } from "@/lib/api-helpers";
import { getStorageBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { txId: string } }) {
  return guarded(async () => {
    const obj = await getStorageBackend().fetch(params.txId);
    if (!obj) throw new ApiError(404, "arweave_not_found");
    return obj;
  });
}
