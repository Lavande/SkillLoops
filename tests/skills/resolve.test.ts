import { describe, expect, it } from "vitest";
import { resolveSkillCandidates } from "@/lib/skills/resolve";

const rows = [
  {
    skill_id: "3RNraEMdZmagDdwhcNmGh9La9JxwcVa7dJzZWpseoDRz",
    author: "Alice1111111111111111111111111111111111111",
    name: "SLP Canary Access Reviewer",
    description: "Reviews web access-control changes.",
    category: "security",
    current_version: 1,
    subscriber_count: 4,
    created_at: 100,
  },
  {
    skill_id: "2LSw1PDXgKvkGT3rS5Hf42pKnKebcqRWWaGBvgiGVHsA",
    author: "Bob111111111111111111111111111111111111111",
    name: "SLP Canary PR Reviewer",
    description: "Reviews pull requests.",
    category: "code-review",
    current_version: 3,
    subscriber_count: 9,
    created_at: 200,
  },
  {
    skill_id: "8D9X9BVqsfV765FH8TcaSBJAGhp6rzegDTTbdzCddBQJ",
    author: "Carol1111111111111111111111111111111111111",
    name: "SLP Canary Access Reviewer",
    description: "Fork with the same display name.",
    category: "security",
    current_version: 1,
    subscriber_count: 1,
    created_at: 50,
  },
];

describe("resolveSkillCandidates", () => {
  it("returns one exact candidate as auto-selectable", () => {
    const result = resolveSkillCandidates(rows, {
      name: "SLP Canary PR Reviewer",
      version: 3,
    });

    expect(result.status).toBe("single_exact");
    expect(result.autoSelectableSkillId).toBe("2LSw1PDXgKvkGT3rS5Hf42pKnKebcqRWWaGBvgiGVHsA");
    expect(result.candidates).toHaveLength(1);
  });

  it("does not auto-select duplicate exact names", () => {
    const result = resolveSkillCandidates(rows, {
      name: "SLP Canary Access Reviewer",
      version: 1,
    });

    expect(result.status).toBe("multiple_exact");
    expect(result.autoSelectableSkillId).toBeNull();
    expect(result.candidates.map((c) => c.skillId)).toEqual([
      "3RNraEMdZmagDdwhcNmGh9La9JxwcVa7dJzZWpseoDRz",
      "8D9X9BVqsfV765FH8TcaSBJAGhp6rzegDTTbdzCddBQJ",
    ]);
  });

  it("falls back to fuzzy candidates without auto-selecting", () => {
    const result = resolveSkillCandidates(rows, {
      name: "access reviewer",
      version: 1,
    });

    expect(result.status).toBe("fuzzy");
    expect(result.autoSelectableSkillId).toBeNull();
    expect(result.candidates[0].confidence).toBe("fuzzy");
  });

  it("uses version as a preference, not a hard filter", () => {
    const result = resolveSkillCandidates(rows, {
      name: "SLP Canary PR Reviewer",
      version: 1,
    });

    expect(result.status).toBe("single_exact");
    expect(result.autoSelectableSkillId).toBe("2LSw1PDXgKvkGT3rS5Hf42pKnKebcqRWWaGBvgiGVHsA");
  });
});
