import { describe, expect, it, vi } from "vitest";
import { getBrowserStorageMode, uploadObject } from "@/lib/browser-irys";

describe("getBrowserStorageMode", () => {
  it("defaults to API upload mode", () => {
    expect(getBrowserStorageMode({})).toBe("api");
  });

  it("selects browser Irys mode from public env", () => {
    expect(getBrowserStorageMode({ NEXT_PUBLIC_STORAGE_MODE: "browser-irys" })).toBe("browser-irys");
  });
});

describe("uploadObject", () => {
  it("uses injected API uploader and does not import Irys in API mode", async () => {
    const importImpl = vi.fn();
    const apiUpload = vi.fn(async () => ({ txId: "api_tx" }));

    const result = await uploadObject({
      owner: "owner_1",
      wallet: { publicKey: "wallet" },
      content: "hello",
      tags: [{ name: "Type", value: "Test" }],
    }, {
      env: { NEXT_PUBLIC_STORAGE_MODE: "api" },
      importImpl,
      apiUpload,
    });

    expect(result).toEqual({ txId: "api_tx", via: "api" });
    expect(apiUpload).toHaveBeenCalledWith("owner_1", "", {
      content: "hello",
      tags: [{ name: "Type", value: "Test" }],
    });
    expect(importImpl).not.toHaveBeenCalled();
  });

  it("uploads through browser Irys with wallet provider and devnet config", async () => {
    const upload = vi.fn(async () => ({ id: "irys_tx" }));
    const builder = {
      withProvider: vi.fn(() => builder),
      devnet: vi.fn(() => builder),
      upload,
    };
    const importImpl = vi.fn(async (specifier: string) => {
      if (specifier === "@irys/web-upload") return { WebUploader: vi.fn(() => builder) };
      if (specifier === "@irys/web-upload-solana") return { WebSolana: "solana-adapter" };
      throw new Error(`unexpected import ${specifier}`);
    });

    const wallet = { publicKey: "wallet" };
    const result = await uploadObject({
      owner: "owner_1",
      wallet,
      content: "hello",
      tags: [{ name: "Type", value: "Test" }],
    }, {
      env: { NEXT_PUBLIC_STORAGE_MODE: "browser-irys", NEXT_PUBLIC_SOLANA_CLUSTER: "devnet" },
      importImpl,
    });

    expect(result).toEqual({ txId: "irys_tx", via: "browser-irys" });
    expect(builder.withProvider).toHaveBeenCalledWith(wallet);
    expect(builder.devnet).toHaveBeenCalled();
    expect(upload).toHaveBeenCalledWith("hello", {
      tags: [{ name: "Type", value: "Test" }],
    });
  });

  it("throws when browser Irys upload does not return an id", async () => {
    const builder = {
      withProvider: vi.fn(() => builder),
      devnet: vi.fn(() => builder),
      upload: vi.fn(async () => ({})),
    };
    const importImpl = vi.fn(async (specifier: string) => {
      if (specifier === "@irys/web-upload") return { WebUploader: vi.fn(() => builder) };
      if (specifier === "@irys/web-upload-solana") return { WebSolana: "solana-adapter" };
      throw new Error(`unexpected import ${specifier}`);
    });

    await expect(uploadObject({
      owner: "owner_1",
      wallet: { publicKey: "wallet" },
      content: "hello",
      tags: [],
    }, {
      env: { NEXT_PUBLIC_STORAGE_MODE: "browser-irys", NEXT_PUBLIC_SOLANA_CLUSTER: "devnet" },
      importImpl,
    })).rejects.toThrow(/browser_irys_upload_missing_id/);
  });
});
