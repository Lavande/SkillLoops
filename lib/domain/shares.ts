import {
  K_DEFAULT,
  MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT,
  MIN_APPROVE_SCORE,
  OWNERSHIP_BPS,
  POINTS_PER_100BPS_DEFAULT,
} from "./thresholds";

export interface OwnershipLedgerState {
  author_ownership_bps: number;
  contributor_pool_bps: number;
  min_author_ratio_bps: number;
  total_contributor_weight: number;
  contributor_count: number;
  points_per_100bps: number;
  max_pool_increase_per_evaluation_bps: number;
}

export interface ContributorAccountState {
  contribution_weight: number;
}

export interface EvaluationInput {
  score: number;
  k?: number;
  ledger: OwnershipLedgerState;
  contributor: ContributorAccountState;
}

export interface EvaluationResult {
  approved: boolean;
  contributionWeightDelta: number;
  ownershipDeltaBps: number;
  newLedger: OwnershipLedgerState;
  newContributor: ContributorAccountState;
}

export interface ContributorOwnershipInput {
  holder: string;
  contributor: ContributorAccountState;
}

export interface OwnershipRow {
  holder: string;
  role: "author" | "contributor";
  ownershipBps: number;
}

export function initialOwnershipLedger(minAuthorRatioBps: number): OwnershipLedgerState {
  return {
    author_ownership_bps: OWNERSHIP_BPS,
    contributor_pool_bps: 0,
    min_author_ratio_bps: minAuthorRatioBps,
    total_contributor_weight: 0,
    contributor_count: 0,
    points_per_100bps: POINTS_PER_100BPS_DEFAULT,
    max_pool_increase_per_evaluation_bps: MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT,
  };
}

export function earlyMultiplierBps(count: number): number {
  if (count === 0) {
    return 2500;
  }
  if (count <= 2) {
    return 4000;
  }
  if (count <= 8) {
    return 6500;
  }
  return OWNERSHIP_BPS;
}

export function evaluateContributionOwnership({
  score,
  k = K_DEFAULT,
  ledger,
  contributor,
}: EvaluationInput): EvaluationResult {
  if (score < MIN_APPROVE_SCORE) {
    return {
      approved: false,
      contributionWeightDelta: 0,
      ownershipDeltaBps: 0,
      newLedger: ledger,
      newContributor: contributor,
    };
  }

  const previousOwnershipBps = contributorOwnershipBps(ledger, contributor.contribution_weight);
  const rawWeight = score * k;
  const multiplier = earlyMultiplierBps(ledger.contributor_count);
  const contributionWeightDelta = Math.floor((rawWeight * multiplier) / OWNERSHIP_BPS);
  const newContributor = {
    ...contributor,
    contribution_weight: contributor.contribution_weight + contributionWeightDelta,
  };
  const totalContributorWeight = ledger.total_contributor_weight + contributionWeightDelta;
  const maxContributorPoolBps = OWNERSHIP_BPS - ledger.min_author_ratio_bps;
  const targetPoolBps = Math.min(
    maxContributorPoolBps,
    Math.floor(totalContributorWeight / ledger.points_per_100bps) * 100,
  );
  const contributorPoolBps = Math.max(
    ledger.contributor_pool_bps,
    Math.min(
      targetPoolBps,
      ledger.contributor_pool_bps + ledger.max_pool_increase_per_evaluation_bps,
    ),
  );
  const newLedger = {
    ...ledger,
    author_ownership_bps: OWNERSHIP_BPS - contributorPoolBps,
    contributor_pool_bps: contributorPoolBps,
    total_contributor_weight: totalContributorWeight,
    contributor_count:
      ledger.contributor_count +
      (contributor.contribution_weight === 0 && contributionWeightDelta > 0 ? 1 : 0),
  };
  const ownershipDeltaBps = Math.max(
    0,
    contributorOwnershipBps(newLedger, newContributor.contribution_weight) - previousOwnershipBps,
  );

  return {
    approved: true,
    contributionWeightDelta,
    ownershipDeltaBps,
    newLedger,
    newContributor,
  };
}

export function contributorOwnershipBps(
  ledger: OwnershipLedgerState,
  contributionWeight: number,
): number {
  if (ledger.total_contributor_weight <= 0 || contributionWeight <= 0) {
    return 0;
  }
  return Math.floor(
    (ledger.contributor_pool_bps * contributionWeight) / ledger.total_contributor_weight,
  );
}

export function deriveOwnershipBps({
  ledger,
  contributors,
}: {
  ledger: OwnershipLedgerState;
  contributors: ContributorOwnershipInput[];
}): OwnershipRow[] {
  const rows: OwnershipRow[] = [
    {
      holder: "author",
      role: "author",
      ownershipBps: ledger.author_ownership_bps,
    },
  ];

  for (const { holder, contributor } of contributors) {
    if (contributor.contribution_weight <= 0) {
      continue;
    }
    rows.push({
      holder,
      role: "contributor",
      ownershipBps: contributorOwnershipBps(ledger, contributor.contribution_weight),
    });
  }

  const totalOwnershipBps = rows.reduce((sum, row) => sum + row.ownershipBps, 0);
  const remainderBps = OWNERSHIP_BPS - totalOwnershipBps;
  if (remainderBps > 0) {
    let largestIndex = 0;
    for (let index = 1; index < rows.length; index += 1) {
      if (rows[index].ownershipBps > rows[largestIndex].ownershipBps) {
        largestIndex = index;
      }
    }
    rows[largestIndex] = {
      ...rows[largestIndex],
      ownershipBps: rows[largestIndex].ownershipBps + remainderBps,
    };
  }

  return rows;
}
