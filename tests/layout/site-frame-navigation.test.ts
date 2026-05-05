import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("SiteFrame navigation", () => {
  it("keeps presentation routes out of the top menu without exposing the console", () => {
    const src = read("components/brutalist/SiteFrame.tsx");

    expect(src).toContain('pathname?.startsWith("/deck")');
    expect(src).toContain('pathname?.startsWith("/pitch")');
    expect(src).not.toContain('href="/deck"');
    expect(src).not.toContain('href="/pitch"');
    expect(src).not.toContain(">Deck</Link>");
    expect(src).not.toContain(">Pitch</Link>");
    expect(src).not.toContain('href="/console"');
    expect(src).not.toContain(">Console</Link>");
  });

  it("keeps presentation route pages intact", () => {
    expect(fs.existsSync(path.join(process.cwd(), "app/deck/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "app/pitch/page.tsx"))).toBe(true);
    expect(fs.existsSync(path.join(process.cwd(), "app/demo/page.tsx"))).toBe(false);

    const deckSrc = read("app/deck/page.tsx");
    expect(deckSrc).toContain("export default function DeckPage()");
    expect(deckSrc).not.toContain("export default function DemoDeck()");
    expect(deckSrc).toContain('["DECK", "/deck"]');
    expect(deckSrc).not.toContain('["DECK", "/demo"]');

    const pitchSrc = read("app/pitch/page.tsx");
    expect(pitchSrc).toContain("export default function PitchPage()");
  });

  it("keeps the global frame usable on narrow screens", () => {
    const src = read("components/brutalist/SiteFrame.tsx");

    expect(src).toContain("overflow-x-clip");
    expect(src).toContain("flex-col");
    expect(src).toContain("overflow-x-auto");
    expect(src).toContain("px-4 sm:px-6");
    expect(src).toContain("env(safe-area-inset-bottom)");
  });
});
