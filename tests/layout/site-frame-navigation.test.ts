import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("SiteFrame navigation", () => {
  it("links the deck in the top menu without exposing the console", () => {
    const src = read("components/brutalist/SiteFrame.tsx");

    expect(src).toContain('pathname?.startsWith("/deck")');
    expect(src).toContain('href="/deck"');
    expect(src).toContain(">Deck</Link>");
    expect(src).not.toContain('href="/console"');
    expect(src).not.toContain(">Console</Link>");
  });

  it("uses deck as the presentation route name", () => {
    expect(fs.existsSync(path.join(process.cwd(), "app/deck/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "app/demo/page.tsx"))).toBe(false);

    const src = read("app/deck/page.tsx");
    expect(src).toContain("export default function DeckPage()");
    expect(src).not.toContain("export default function DemoDeck()");
    expect(src).toContain('["DECK", "/deck"]');
    expect(src).not.toContain('["DECK", "/demo"]');
  });

  it("keeps the global frame usable on narrow screens", () => {
    const src = read("components/brutalist/SiteFrame.tsx");

    expect(src).toContain("overflow-x-clip");
    expect(src).toContain("flex-col");
    expect(src).toContain("overflow-x-auto");
    expect(src).toContain("px-4 sm:px-6");
    expect(src).toContain("pb-[env(safe-area-inset-bottom)]");
  });
});
