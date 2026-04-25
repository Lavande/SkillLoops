import { ArweaveMock, type ArweaveObject, type ArweaveUpload, type Tag } from "@/lib/mock/arweave";

export interface StorageBackend {
  name: "mock" | "irys";
  upload(content: string, tags: Tag[], owner: string): Promise<ArweaveUpload>;
  fetch(txId: string): Promise<ArweaveObject | null>;
}

interface IrysDeps {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  importImpl?: (specifier: string) => Promise<any>;
}

const runtimeImport = (specifier: string) =>
  new Function("specifier", "return import(specifier)")(specifier) as Promise<any>;

export const mockStorage: StorageBackend = {
  name: "mock",
  async upload(content, tags, owner) {
    return ArweaveMock.upload(content, tags, owner);
  },
  async fetch(txId) {
    return ArweaveMock.fetch(txId);
  },
};

export const irysStorage = {
  name: "irys" as const,
  async upload(content: string, tags: Tag[], owner: string, deps: IrysDeps = {}): Promise<ArweaveUpload> {
    const env = deps.env ?? process.env;
    const privateKey = env.IRYS_PRIVATE_KEY;
    if (!privateKey) throw new Error("irys_private_key_required");

    const importImpl = deps.importImpl ?? runtimeImport;
    const [{ Uploader }, { Solana }] = await Promise.all([
      importImpl("@irys/upload"),
      importImpl("@irys/upload-solana"),
    ]);

    let uploaderBuilder = Uploader(Solana).withWallet(privateKey);
    if (env.NEXT_PUBLIC_SOLANA_RPC && typeof uploaderBuilder.withRpc === "function") {
      uploaderBuilder = uploaderBuilder.withRpc(env.NEXT_PUBLIC_SOLANA_RPC);
    }
    if (env.IRYS_NETWORK === "devnet" && typeof uploaderBuilder.devnet === "function") {
      uploaderBuilder = uploaderBuilder.devnet();
    }
    const uploader = await uploaderBuilder;

    const receipt = await uploader.upload(content, {
      tags: [
        ...tags,
        { name: "Owner", value: owner },
        { name: "Content-Type", value: "application/json" },
      ],
    });
    const id = receipt?.id;
    if (!id || typeof id !== "string") throw new Error("irys_upload_missing_id");
    return { txId: id };
  },
  async fetch(txId: string, deps: IrysDeps = {}): Promise<ArweaveObject | null> {
    const env = deps.env ?? process.env;
    const fetchImpl = deps.fetchImpl ?? fetch;
    const gateway = (env.IRYS_GATEWAY_URL ?? "https://gateway.irys.xyz").replace(/\/+$/, "");
    const res = await fetchImpl(`${gateway}/${txId}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`irys_fetch_failed_${res.status}`);
    return {
      content: await res.text(),
      tags: [],
      owner: "irys",
      uploadedAt: Math.floor(Date.now() / 1000),
    };
  },
} satisfies StorageBackend & {
  upload(content: string, tags: Tag[], owner: string, deps?: IrysDeps): Promise<ArweaveUpload>;
  fetch(txId: string, deps?: IrysDeps): Promise<ArweaveObject | null>;
};

export function getStorageBackend(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): StorageBackend {
  return env.STORAGE_BACKEND === "irys" ? irysStorage : mockStorage;
}
