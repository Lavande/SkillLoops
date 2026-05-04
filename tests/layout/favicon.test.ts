import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("favicon", () => {
  it("uses the top-left loop logo as a browser icon SVG", () => {
    const iconPath = path.join(process.cwd(), "app", "icon.svg");

    expect(fs.existsSync(iconPath)).toBe(true);

    const src = read("app/icon.svg");
    expect(src).toContain('viewBox="0 0 32 32"');
    expect(src).toContain('stroke="#0B0B0B"');
    expect(src).toContain('fill="#0B0B0B"');
    expect(src).toContain('stroke="#FF5B1F"');
    expect(src).toContain("A 12 12 0 0 1");
  });
});
