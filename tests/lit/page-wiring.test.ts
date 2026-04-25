import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("Slice 5 page wiring", () => {
  it("publish page uses Lit encryption and browser upload adapter", () => {
    const src = read("app/publish/page.tsx");

    expect(src).toContain("encryptSkillContent");
    expect(src).toContain("uploadObject");
    expect(src).not.toContain("signMessage");
    expect(src).not.toContain("api.uploadIrys");
  });

  it("submit page uses browser upload adapter", () => {
    const src = read("app/submit/page.tsx");

    expect(src).toContain("uploadObject");
    expect(src).not.toContain("signMessage");
    expect(src).not.toContain("api.uploadIrys");
  });

  it("skill page decrypts fetched content through Lit client adapter", () => {
    const src = read("app/skill/[id]/page.tsx");

    expect(src).toContain("decryptSkillContent");
    expect(src).not.toContain("api.litDecrypt");
  });

  it("console remains on deterministic mock/API path", () => {
    const src = read("app/console/page.tsx");

    expect(src).not.toContain("@/lib/browser-irys");
    expect(src).not.toContain("@/lib/lit/client");
    expect(src).toContain("api.uploadIrys");
  });
});
