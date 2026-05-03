import { NextRequest, NextResponse } from "next/server";

export function caller(req: NextRequest): string | null {
  return req.headers.get("x-slp-wallet");
}

export function requireCaller(req: NextRequest): string {
  const c = caller(req);
  if (!c) throw new ApiError(401, "wallet_required");
  return c;
}

/**
 * In DEMO_MODE, /console can submit an `impersonate` header so it can drive
 * actions on behalf of any persona without swapping Phantom wallets.
 */
export function effectiveActor(req: NextRequest): string {
  const impersonate = req.headers.get("x-slp-impersonate");
  if (impersonate && process.env.DEMO_MODE === "true") return impersonate;
  return requireCaller(req);
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, public detail?: unknown) {
    super(code);
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function bad(status: number, code: string, detail?: unknown) {
  return NextResponse.json({ ok: false, error: code, detail }, { status });
}

export async function guarded<T>(handler: () => Promise<T>): Promise<NextResponse> {
  try {
    const value = await handler();
    return ok(value);
  } catch (e) {
    if (e instanceof ApiError) return bad(e.status, e.code, e.detail);
    console.error("[api] error", e);
    return bad(500, "internal_error", e instanceof Error ? e.message : String(e));
  }
}

export function genId(prefix = "sk"): string {
  const rnd = crypto.randomUUID().replace(/-/g, "").slice(0, 22);
  return `${prefix}_${rnd}`;
}

export function ownershipPct(ownershipBps: number): number {
  return ownershipBps / 100;
}

export function contributorOwnershipBps({
  contributorPoolBps,
  contributionWeight,
  totalContributorWeight,
}: {
  contributorPoolBps: number;
  contributionWeight: number;
  totalContributorWeight: number;
}): number {
  if (totalContributorWeight <= 0 || contributionWeight <= 0) return 0;
  return Math.floor((contributorPoolBps * contributionWeight) / totalContributorWeight);
}
