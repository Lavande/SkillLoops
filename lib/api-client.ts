"use client";

import { authHeaders } from "./wallet";

type ApiOk<T> = { ok: true; data: T };
type ApiErr = { ok: false; error: string; detail?: unknown };

async function request<T>(url: string, init: RequestInit = {}, walletCtx?: { wallet: string | null; signature?: string }): Promise<T> {
  const headers = {
    ...authHeaders(walletCtx?.wallet ?? null, walletCtx?.signature),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(url, { ...init, headers });
  const body = (await res.json().catch(() => ({}))) as ApiOk<T> | ApiErr;
  if (!res.ok || (body as ApiErr).ok === false) {
    const err = body as ApiErr;
    throw new Error(err.error ?? `http_${res.status}`);
  }
  return (body as ApiOk<T>).data;
}

export const api = {
  listSkills: (params: { category?: string; q?: string; sort?: string } = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && qs.set(k, String(v)));
    return request<any[]>(`/api/skills?${qs.toString()}`);
  },
  skill: (id: string, wallet: string | null) => request<any>(`/api/skills/${id}`, {}, { wallet }),
  resolveSkill: (body: { name: string; version?: number }) =>
    request<any>(`/api/skills/resolve`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  experience: (id: number, wallet: string | null) => request<any>(`/api/experiences/${id}`, {}, { wallet }),
  me: (wallet: string) => request<any>(`/api/me`, {}, { wallet }),
  seed: () => request<any>(`/api/seed`, { method: "POST" }),
  judgeTick: () => request<any>(`/api/judge/tick`, { method: "POST" }),

  uploadIrys: (wallet: string, signature: string, body: { content: string; tags?: { name: string; value: string }[] }) =>
    request<{ txId: string }>(`/api/irys/upload`, {
      method: "POST",
      body: JSON.stringify(body),
    }, { wallet, signature }),
  litDecrypt: (wallet: string, signature: string, body: { ciphertext: string; skillId: string }) =>
    request<{ plaintext: string }>(`/api/lit/decrypt`, { method: "POST", body: JSON.stringify(body) }, { wallet, signature }),
  fetchIrys: (txId: string) => request<{ content: string; tags: any[]; owner: string; uploadedAt: number }>(`/api/irys/${txId}`),

  consoleStep: (step: string, impersonate?: string) =>
    request<any>(`/api/console/step`, {
      method: "POST",
      body: JSON.stringify({ step }),
      headers: impersonate ? { "x-slp-impersonate": impersonate } : undefined,
    }),

  indexerTick: (sig?: string) =>
    request<{ processed: number }>(`/api/indexer/tick`, {
      method: "POST",
      body: JSON.stringify(sig ? { sig } : {}),
    }),
  indexerStatus: (verify = false) =>
    request<{ running: boolean; lastSeenSig: string | null; lastSeenSlot: number | null; parseFailures: number; ok?: boolean; mismatches?: any[] }>(
      `/api/indexer/status${verify ? "?verify=1" : ""}`,
    ),
};
