import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("root layout fonts", () => {
  it("uses Google fonts by default with local fallbacks", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");

    expect(src).toContain("next/font/google");
    expect(src).toContain("Archivo_Narrow");
    expect(src).toContain("IBM_Plex_Mono");
    expect(src).toContain("Fraunces");
    expect(src).toContain("fallback:");
  });
});
