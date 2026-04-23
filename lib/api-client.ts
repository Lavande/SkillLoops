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

  publish: (wallet: string, signature: string, body: any) =>
    request<{ skillId: string; arweaveTxId: string }>(`/api/skills`, { method: "POST", body: JSON.stringify(body) }, { wallet, signature }),
  subscribe: (wallet: string, signature: string, body: { skill_id: string }) =>
    request<any>(`/api/subscriptions`, { method: "POST", body: JSON.stringify(body) }, { wallet, signature }),
  submitExperience: (wallet: string, signature: string, body: any) =>
    request<{ experienceId: number }>(`/api/experiences`, { method: "POST", body: JSON.stringify(body) }, { wallet, signature }),
  settle: (wallet: string, signature: string, skillId: string) =>
    request<any>(`/api/revenue/${skillId}/settle`, { method: "POST", body: "{}" }, { wallet, signature }),
  claim: (wallet: string, signature: string, skillId: string) =>
    request<any>(`/api/revenue/${skillId}/claim`, { method: "POST", body: "{}" }, { wallet, signature }),

  consoleStep: (step: string, impersonate?: string) =>
    request<any>(`/api/console/step`, {
      method: "POST",
      body: JSON.stringify({ step }),
      headers: impersonate ? { "x-slp-impersonate": impersonate } : undefined,
    }),
};
