import { describe, expect, it } from "vitest";
import { getStageLabelRadius, roundSvgNumber } from "@/components/loop/SkillLoopMotif";

describe("SkillLoopMotif geometry", () => {
  it("rounds svg numbers to stable hydration-safe strings", () => {
    expect(roundSvgNumber(46.62542241839124)).toBe(46.625422);
    expect(roundSvgNumber(46.62542241839125)).toBe(46.625422);
  });

  it("keeps standard stage labels inside the svg viewbox", () => {
    expect(getStageLabelRadius(200, false)).toBeLessThan(100);
    expect(getStageLabelRadius(420, false)).toBeLessThan(210);
  });

  it("allows dense diagrams to use the outer label treatment", () => {
    expect(getStageLabelRadius(180, true)).toBeGreaterThan(90);
  });
});
