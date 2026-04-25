import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { closeDb, getDb } from "@/lib/db";
import { getStorageBackend, irysStorage, mockStorage } from "@/lib/storage";

beforeEach(() => {
  closeDb();
  getDb(":memory:");
});

describe("storage backends", () => {
  it("defaults to mock storage", () => {
    expect(getStorageBackend({}).name).toBe("mock");
  });

  it("selects Irys storage when STORAGE_BACKEND=irys", () => {
    expect(getStorageBackend({ STORAGE_BACKEND: "irys" }).name).toBe("irys");
  });

  it("mock storage preserves upload and fetch behavior", async () => {
    const up = await mockStorage.upload("hello", [{ name: "Type", value: "Test" }], "owner-1");
    const obj = await mockStorage.fetch(up.txId);

    expect(up.txId).toMatch(/^ar_/);
    expect(obj?.content).toBe("hello");
    expect(obj?.tags).toEqual([{ name: "Type", value: "Test" }]);
    expect(obj?.owner).toBe("owner-1");
  });

  it("Irys fetch returns null for gateway 404", async () => {
    const fetchImpl = vi.fn(async () => new Response("missing", { status: 404 }));
    const obj = await irysStorage.fetch("missing-id", {
      env: { IRYS_GATEWAY_URL: "https://gateway.example" },
      fetchImpl,
    });

    expect(obj).toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith("https://gateway.example/missing-id");
  });
});

describe("Irys API routes", () => {
  it("upload route uses storage adapter instead of ArweaveMock directly", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/api/irys/upload/route.ts"), "utf8");
    expect(src).toContain("getStorageBackend");
    expect(src).not.toContain("ArweaveMock");
  });

  it("fetch route uses storage adapter instead of ArweaveMock directly", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/api/irys/[txId]/route.ts"), "utf8");
    expect(src).toContain("getStorageBackend");
    expect(src).not.toContain("ArweaveMock");
  });
});
