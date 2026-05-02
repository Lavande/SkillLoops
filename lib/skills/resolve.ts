export interface SkillResolveRow {
  skill_id: string;
  author: string;
  name: string;
  description: string;
  category: string;
  current_version: number;
  subscriber_count: number;
  created_at: number;
}

export interface SkillResolveTarget {
  name: string;
  version?: number;
}

export interface SkillResolveCandidate {
  skillId: string;
  author: string;
  name: string;
  description: string;
  category: string;
  currentVersion: number;
  subscriberCount: number;
  confidence: "exact" | "fuzzy";
}

export interface SkillResolveResult {
  status: "no_match" | "single_exact" | "multiple_exact" | "fuzzy";
  autoSelectableSkillId: string | null;
  candidates: SkillResolveCandidate[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function shape(row: SkillResolveRow, confidence: SkillResolveCandidate["confidence"]): SkillResolveCandidate {
  return {
    skillId: row.skill_id,
    author: row.author,
    name: row.name,
    description: row.description,
    category: row.category,
    currentVersion: row.current_version,
    subscriberCount: row.subscriber_count,
    confidence,
  };
}

function sortRows(rows: SkillResolveRow[], preferredVersion?: number): SkillResolveRow[] {
  return [...rows].sort((a, b) => {
    if (preferredVersion) {
      const aVersion = a.current_version === preferredVersion ? 1 : 0;
      const bVersion = b.current_version === preferredVersion ? 1 : 0;
      if (bVersion !== aVersion) return bVersion - aVersion;
    }
    if (b.subscriber_count !== a.subscriber_count) return b.subscriber_count - a.subscriber_count;
    return b.created_at - a.created_at;
  });
}

export function resolveSkillCandidates(
  rows: SkillResolveRow[],
  target: SkillResolveTarget,
): SkillResolveResult {
  const targetName = normalize(target.name);
  if (!targetName) {
    return { status: "no_match", autoSelectableSkillId: null, candidates: [] };
  }

  const exact = sortRows(
    rows.filter((row) => normalize(row.name) === targetName),
    target.version,
  );

  if (exact.length === 1) {
    return {
      status: "single_exact",
      autoSelectableSkillId: exact[0].skill_id,
      candidates: exact.map((row) => shape(row, "exact")),
    };
  }

  if (exact.length > 1) {
    return {
      status: "multiple_exact",
      autoSelectableSkillId: null,
      candidates: exact.map((row) => shape(row, "exact")),
    };
  }

  const tokens = targetName.split(" ").filter(Boolean);
  const fuzzy = sortRows(rows.filter((row) => {
    const haystack = normalize(`${row.name} ${row.description} ${row.category}`);
    return tokens.every((token) => haystack.includes(token));
  }), target.version);

  return {
    status: fuzzy.length ? "fuzzy" : "no_match",
    autoSelectableSkillId: null,
    candidates: fuzzy.slice(0, 8).map((row) => shape(row, "fuzzy")),
  };
}
