import { NextRequest } from "next/server";
import { ApiError, guarded } from "@/lib/api-helpers";
import { ArweaveMock } from "@/lib/mock/arweave";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { txId: string } }) {
  return guarded(async () => {
    const obj = ArweaveMock.fetch(params.txId);
    if (!obj) throw new ApiError(404, "arweave_not_found");
    return obj;
  });
}
