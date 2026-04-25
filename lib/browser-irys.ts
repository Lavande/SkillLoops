"use client";

import { api } from "@/lib/api-client";

export interface BrowserUploadInput {
  content: string;
  tags: { name: string; value: string }[];
  wallet: unknown;
  owner: string;
}

export interface BrowserUploadResult {
  txId: string;
  via: "api" | "browser-irys";
}

interface BrowserUploadDeps {
  env?: Record<string, string | undefined>;
  importImpl?: (specifier: string) => Promise<any>;
  apiUpload?: (
    wallet: string,
    signature: string,
    body: { content: string; tags?: { name: string; value: string }[] },
  ) => Promise<{ txId: string }>;
}

const runtimeImport = (specifier: string) =>
  new Function("specifier", "return import(specifier)")(specifier) as Promise<any>;

export function getBrowserStorageMode(
  env: Record<string, string | undefined> = process.env as any,
): "api" | "browser-irys" {
  return env.NEXT_PUBLIC_STORAGE_MODE === "browser-irys" ? "browser-irys" : "api";
}

export async function uploadObject(
  input: BrowserUploadInput,
  deps: BrowserUploadDeps = {},
): Promise<BrowserUploadResult> {
  const env = deps.env ?? (process.env as any);
  const mode = getBrowserStorageMode(env);
  if (mode === "api") {
    const upload = deps.apiUpload ?? api.uploadIrys;
    const result = await upload(input.owner, "", { content: input.content, tags: input.tags });
    return { txId: result.txId, via: "api" };
  }

  const importImpl = deps.importImpl ?? runtimeImport;
  const [{ WebUploader }, { WebSolana }] = await Promise.all([
    importImpl("@irys/web-upload"),
    importImpl("@irys/web-upload-solana"),
  ]);

  let uploaderBuilder = WebUploader(WebSolana).withProvider(input.wallet);
  if ((env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet") === "devnet" && typeof uploaderBuilder.devnet === "function") {
    uploaderBuilder = uploaderBuilder.devnet();
  }
  const uploader = await uploaderBuilder;

  const receipt = await uploader.upload(input.content, { tags: input.tags });
  const id = receipt?.id;
  if (!id || typeof id !== "string") throw new Error("browser_irys_upload_missing_id");
  return { txId: id, via: "browser-irys" };
}
