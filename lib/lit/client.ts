"use client";

import { getChainConfig, type ChainConfig } from "@/lib/chain/config";
import { buildSkillAccessConditions } from "./access";

export interface EncryptedSkillPayload {
  kind: "slp-lit-v1";
  ciphertext: string;
  dataToEncryptHash: string;
  solRpcConditions: unknown[];
  litNetwork: string;
}

interface LitDeps {
  env?: Record<string, string | undefined>;
  importImpl?: (specifier: string) => Promise<any>;
  chainConfig?: Pick<ChainConfig, "programId" | "cluster"> | { programId: string; cluster: ChainConfig["cluster"] };
  litNodeClient?: unknown;
  sessionSigs?: unknown;
  authSig?: unknown;
}

const runtimeImport = (specifier: string) =>
  new Function("specifier", "return import(specifier)")(specifier) as Promise<any>;

export function getLitMode(
  env: Record<string, string | undefined> = process.env as any,
): "mock" | "real" {
  return env.NEXT_PUBLIC_LIT_MODE === "real" ? "real" : "mock";
}

export async function encryptSkillContent(args: {
  plaintext: string;
  skillId: string;
  author: string;
  wallet: unknown;
}, deps: LitDeps = {}): Promise<{ content: string; encrypted: boolean }> {
  const env = deps.env ?? (process.env as any);
  if (getLitMode(env) === "mock") {
    return { content: mockEncrypt(args.plaintext, args.skillId), encrypted: false };
  }

  const chainConfig = resolveChainConfig(deps.chainConfig);
  const solRpcConditions = buildSkillAccessConditions({
    programId: programIdString(chainConfig.programId),
    skillId: args.skillId,
    author: args.author,
    cluster: chainConfig.cluster,
  });
  const litNetwork = env.NEXT_PUBLIC_LIT_NETWORK ?? "datil-dev";
  const importImpl = deps.importImpl ?? runtimeImport;
  const { encryptString } = await importImpl("@lit-protocol/encryption");
  const encrypted = await encryptString({
    solRpcConditions,
    dataToEncrypt: args.plaintext,
    authSig: deps.authSig ?? await createSolanaAuthSig(args.wallet, `SLP Lit encrypt\nskill: ${args.skillId}\nt: ${Date.now()}`),
  });
  const payload: EncryptedSkillPayload = {
    kind: "slp-lit-v1",
    ciphertext: encrypted.ciphertext,
    dataToEncryptHash: encrypted.dataToEncryptHash,
    solRpcConditions,
    litNetwork,
  };
  return { content: JSON.stringify(payload), encrypted: true };
}

export async function decryptSkillContent(args: {
  content: string;
  skillId: string;
  wallet: unknown;
  caller: string;
}, deps: LitDeps = {}): Promise<string> {
  const env = deps.env ?? (process.env as any);
  if (getLitMode(env) === "mock") {
    return mockDecrypt(args.content, args.skillId);
  }

  const payload = parseEncryptedSkillPayload(args.content);
  const importImpl = deps.importImpl ?? runtimeImport;
  const { decryptToString } = await importImpl("@lit-protocol/encryption");
  return decryptToString({
    solRpcConditions: payload.solRpcConditions,
    ciphertext: payload.ciphertext,
    dataToEncryptHash: payload.dataToEncryptHash,
    litNodeClient: deps.litNodeClient ?? await createLitNodeClient(payload.litNetwork, importImpl),
    authSig: deps.authSig ?? await createSolanaAuthSig(args.wallet, `SLP Lit decrypt\nskill: ${args.skillId}\nt: ${Date.now()}`),
    ...(deps.sessionSigs ? { sessionSigs: deps.sessionSigs } : {}),
  });
}

export function parseEncryptedSkillPayload(content: string): EncryptedSkillPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("lit_payload_invalid_json");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("lit_payload_invalid");
  }
  const p = parsed as Partial<EncryptedSkillPayload>;
  if (
    p.kind !== "slp-lit-v1" ||
    typeof p.ciphertext !== "string" ||
    typeof p.dataToEncryptHash !== "string" ||
    !Array.isArray(p.solRpcConditions) ||
    typeof p.litNetwork !== "string"
  ) {
    throw new Error("lit_payload_invalid");
  }
  return p as EncryptedSkillPayload;
}

function resolveChainConfig(config: LitDeps["chainConfig"]): Pick<ChainConfig, "programId" | "cluster"> {
  if (config) return config as Pick<ChainConfig, "programId" | "cluster">;
  const c = getChainConfig();
  return { programId: c.programId, cluster: c.cluster };
}

function programIdString(programId: Pick<ChainConfig, "programId">["programId"] | string): string {
  return typeof programId === "string" ? programId : programId.toBase58();
}

async function createLitNodeClient(litNetwork: string, importImpl: (specifier: string) => Promise<any>): Promise<unknown> {
  const { LitNodeClient } = await importImpl("@lit-protocol/lit-node-client");
  const client = new LitNodeClient({ litNetwork });
  if (typeof client.connect === "function") await client.connect();
  return client;
}

function mockEncrypt(plaintext: string, skillId: string): string {
  return `enc::${skillId}::${utf8ToBase64(plaintext)}`;
}

function mockDecrypt(ciphertext: string, skillId: string): string {
  const prefix = `enc::${skillId}::`;
  if (!ciphertext.startsWith(prefix)) throw new Error("wrong_skill");
  return base64ToUtf8(ciphertext.slice(prefix.length));
}

async function createSolanaAuthSig(wallet: unknown, message: string): Promise<unknown> {
  const w = wallet as {
    publicKey?: { toBase58?: () => string } | null;
    signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
  };
  const address = w.publicKey?.toBase58?.();
  if (!address) throw new Error("wallet_not_connected");
  if (!w.signMessage) throw new Error("wallet_no_sign_message");
  const encoded = new TextEncoder().encode(message);
  const sig = await w.signMessage(encoded);
  const { default: bs58 } = await import("bs58");
  return {
    sig: bs58.encode(sig),
    derivedVia: "solana.signMessage",
    signedMessage: message,
    address,
  };
}

function utf8ToBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToUtf8(value: string): string {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
