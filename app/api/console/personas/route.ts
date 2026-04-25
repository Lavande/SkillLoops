import { NextRequest } from "next/server";
import { ApiError, guarded } from "@/lib/api-helpers";
import { loadPersonaVault } from "@/lib/personas";
import { Keypair } from "@solana/web3.js";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  return guarded(async () => {
    if (process.env.DEMO_MODE !== "true") throw new ApiError(403, "demo_mode_required");
    const vault = loadPersonaVault();
    if (!vault) throw new ApiError(404, "personas_not_initialized");
    const pk = (arr: number[]) => Keypair.fromSecretKey(Uint8Array.from(arr)).publicKey.toBase58();
    return {
      alice: pk(vault.alice), bob: pk(vault.bob), carol: pk(vault.carol), judge: pk(vault.judge),
    };
  });
}

export async function POST(_req: NextRequest) {
  return guarded(async () => {
    if (process.env.DEMO_MODE !== "true") throw new ApiError(403, "demo_mode_required");
    const vault = loadPersonaVault();
    if (!vault) throw new ApiError(404, "personas_not_initialized");
    return vault;
  });
}
