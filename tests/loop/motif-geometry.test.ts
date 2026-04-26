import { describe, expect, it } from "vitest";
import { roundSvgNumber } from "@/components/loop/SkillLoopMotif";

describe("SkillLoopMotif geometry", () => {
  it("rounds svg numbers to stable hydration-safe strings", () => {
    expect(roundSvgNumber(46.62542241839124)).toBe(46.625422);
    expect(roundSvgNumber(46.62542241839125)).toBe(46.625422);
  });
});
