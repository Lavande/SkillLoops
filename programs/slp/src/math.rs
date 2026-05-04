// Pure arithmetic for the SLP protocol. no_std-safe; does not use anchor_lang.
// Mirrors lib/domain/shares.ts and lib/domain/revenue.ts.

#[derive(Clone, Copy, Debug)]
pub struct EvaluateOwnershipInput {
    pub score: u8,
    pub k: u16,
    pub author_ownership_bps: u16,
    pub contributor_pool_bps: u16,
    pub min_author_ratio_bps: u16,
    pub total_contributor_weight: u64,
    pub contributor_count: u32,
    pub contributor_weight: u64,
    pub points_per_100bps: u64,
    pub max_pool_increase_per_evaluation_bps: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct EvaluateOwnershipOutput {
    pub contribution_weight_delta: u64,
    pub ownership_delta_bps: u16,
    pub author_ownership_bps: u16,
    pub contributor_pool_bps: u16,
    pub total_contributor_weight: u64,
    pub contributor_count: u32,
}

pub fn early_multiplier_bps(current_nonzero_contributor_count: u32) -> u16 {
    if current_nonzero_contributor_count == 0 {
        2_500
    } else if current_nonzero_contributor_count <= 2 {
        4_000
    } else if current_nonzero_contributor_count <= 8 {
        6_500
    } else {
        10_000
    }
}

pub fn evaluate_contribution_ownership(i: EvaluateOwnershipInput) -> EvaluateOwnershipOutput {
    let raw_weight = (i.score as u64).saturating_mul(i.k as u64);
    let contribution_weight_delta = raw_weight
        .saturating_mul(early_multiplier_bps(i.contributor_count) as u64)
        / 10_000u64;
    let old_ownership = contributor_ownership_bps(
        i.contributor_pool_bps,
        i.contributor_weight,
        i.total_contributor_weight,
    );
    let total_contributor_weight = i
        .total_contributor_weight
        .saturating_add(contribution_weight_delta);
    let max_pool_bps = 10_000u16.saturating_sub(i.min_author_ratio_bps);
    let target_pool_bps_u64 = total_contributor_weight
        .checked_div(i.points_per_100bps.max(1))
        .unwrap_or(0)
        .saturating_mul(100)
        .min(max_pool_bps as u64);
    let target_pool_bps = target_pool_bps_u64 as u16;
    let contributor_pool_bps = i.contributor_pool_bps.max(target_pool_bps.min(
        i.contributor_pool_bps
            .saturating_add(i.max_pool_increase_per_evaluation_bps),
    ));
    let new_contributor_weight = i
        .contributor_weight
        .saturating_add(contribution_weight_delta);
    let new_ownership = contributor_ownership_bps(
        contributor_pool_bps,
        new_contributor_weight,
        total_contributor_weight,
    );
    let contributor_count = if i.contributor_weight == 0 && contribution_weight_delta > 0 {
        i.contributor_count.saturating_add(1)
    } else {
        i.contributor_count
    };

    EvaluateOwnershipOutput {
        contribution_weight_delta,
        ownership_delta_bps: new_ownership.saturating_sub(old_ownership),
        author_ownership_bps: 10_000u16.saturating_sub(contributor_pool_bps),
        contributor_pool_bps,
        total_contributor_weight,
        contributor_count,
    }
}

pub fn contributor_ownership_bps(
    contributor_pool_bps: u16,
    contribution_weight: u64,
    total_contributor_weight: u64,
) -> u16 {
    if total_contributor_weight == 0 || contribution_weight == 0 {
        return 0;
    }
    ((contributor_pool_bps as u128).saturating_mul(contribution_weight as u128)
        / (total_contributor_weight as u128)) as u16
}

#[derive(Clone, Copy, Debug)]
pub struct OwnershipHolder {
    pub contribution_weight: u64,
    pub index: usize,
    pub is_author: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Claim {
    pub index: usize,
    pub amount: u64,
}

pub fn compute_ownership_claims(
    holders: &[OwnershipHolder],
    period_revenue: u64,
    author_ownership_bps: u16,
    contributor_pool_bps: u16,
    total_contributor_weight: u64,
) -> Vec<Claim> {
    if holders.is_empty() {
        return Vec::new();
    }
    if period_revenue == 0 {
        return holders
            .iter()
            .map(|h| Claim {
                index: h.index,
                amount: 0,
            })
            .collect();
    }
    if total_contributor_weight == 0 || contributor_pool_bps == 0 {
        return holders
            .iter()
            .map(|h| Claim {
                index: h.index,
                amount: if h.is_author { period_revenue } else { 0 },
            })
            .collect();
    }

    let author_claim =
        ((period_revenue as u128) * (author_ownership_bps as u128) / 10_000u128) as u64;
    let contributor_revenue = period_revenue.saturating_sub(author_claim);
    let mut claims: Vec<Claim> = holders
        .iter()
        .map(|h| {
            let amount = if h.is_author {
                author_claim
            } else if h.contribution_weight == 0 {
                0
            } else {
                ((contributor_revenue as u128) * (h.contribution_weight as u128)
                    / (total_contributor_weight as u128)) as u64
            };
            Claim {
                index: h.index,
                amount,
            }
        })
        .collect();

    let distributed: u64 = claims.iter().map(|c| c.amount).sum();
    let remainder = period_revenue.saturating_sub(distributed);
    if remainder > 0 {
        let best = largest_effective_holder_index(
            holders,
            author_ownership_bps,
            contributor_pool_bps,
            total_contributor_weight,
        );
        claims[best].amount = claims[best].amount.saturating_add(remainder);
    }
    claims
}

fn largest_effective_holder_index(
    holders: &[OwnershipHolder],
    author_ownership_bps: u16,
    contributor_pool_bps: u16,
    total_contributor_weight: u64,
) -> usize {
    let mut best_pos = 0usize;
    let mut best_bps = 0u16;
    for (pos, h) in holders.iter().enumerate() {
        let bps = if h.is_author {
            author_ownership_bps
        } else {
            contributor_ownership_bps(
                contributor_pool_bps,
                h.contribution_weight,
                total_contributor_weight,
            )
        };
        if pos == 0 || bps > best_bps {
            best_pos = pos;
            best_bps = bps;
        }
    }
    best_pos
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn early_multiplier_tiers() {
        assert_eq!(early_multiplier_bps(0), 2_500);
        assert_eq!(early_multiplier_bps(1), 4_000);
        assert_eq!(early_multiplier_bps(2), 4_000);
        assert_eq!(early_multiplier_bps(3), 6_500);
        assert_eq!(early_multiplier_bps(8), 6_500);
        assert_eq!(early_multiplier_bps(9), 10_000);
    }

    #[test]
    fn first_max_score_contributor_gets_five_percent() {
        let out = evaluate_contribution_ownership(EvaluateOwnershipInput {
            score: 50,
            k: 100,
            author_ownership_bps: 10_000,
            contributor_pool_bps: 0,
            min_author_ratio_bps: 4_000,
            total_contributor_weight: 0,
            contributor_count: 0,
            contributor_weight: 0,
            points_per_100bps: 250,
            max_pool_increase_per_evaluation_bps: 500,
        });
        assert_eq!(out.contribution_weight_delta, 1_250);
        assert_eq!(out.ownership_delta_bps, 500);
        assert_eq!(out.author_ownership_bps, 9_500);
        assert_eq!(out.contributor_pool_bps, 500);
        assert_eq!(out.total_contributor_weight, 1_250);
        assert_eq!(out.contributor_count, 1);
    }

    #[test]
    fn floor_stops_author_dilution_but_allows_new_weight() {
        let out = evaluate_contribution_ownership(EvaluateOwnershipInput {
            score: 50,
            k: 100,
            author_ownership_bps: 4_000,
            contributor_pool_bps: 6_000,
            min_author_ratio_bps: 4_000,
            total_contributor_weight: 1_500,
            contributor_count: 1,
            contributor_weight: 0,
            points_per_100bps: 250,
            max_pool_increase_per_evaluation_bps: 500,
        });
        assert_eq!(out.author_ownership_bps, 4_000);
        assert_eq!(out.contributor_pool_bps, 6_000);
        assert!(out.contribution_weight_delta > 0);
        assert!(out.ownership_delta_bps > 0);
    }

    #[test]
    fn returning_contributor_does_not_increment_count() {
        let out = evaluate_contribution_ownership(EvaluateOwnershipInput {
            score: 30,
            k: 10,
            author_ownership_bps: 9_500,
            contributor_pool_bps: 500,
            min_author_ratio_bps: 4_000,
            total_contributor_weight: 1_250,
            contributor_count: 1,
            contributor_weight: 1_250,
            points_per_100bps: 250,
            max_pool_increase_per_evaluation_bps: 500,
        });
        assert_eq!(out.contribution_weight_delta, 120);
        assert_eq!(out.contributor_count, 1);
        assert_eq!(out.total_contributor_weight, 1_370);
    }

    #[test]
    fn ownership_claims_split_author_and_contributors() {
        let holders = [
            OwnershipHolder {
                contribution_weight: 0,
                index: 0,
                is_author: true,
            },
            OwnershipHolder {
                contribution_weight: 1_500,
                index: 1,
                is_author: false,
            },
            OwnershipHolder {
                contribution_weight: 500,
                index: 2,
                is_author: false,
            },
        ];
        let claims = compute_ownership_claims(&holders, 1_000, 4_000, 6_000, 2_000);
        assert_eq!(claims[0].amount, 400);
        assert_eq!(claims[1].amount, 450);
        assert_eq!(claims[2].amount, 150);
    }

    #[test]
    fn ownership_claims_zero_contributor_weight_pays_author() {
        let holders = [
            OwnershipHolder {
                contribution_weight: 0,
                index: 0,
                is_author: true,
            },
            OwnershipHolder {
                contribution_weight: 0,
                index: 1,
                is_author: false,
            },
        ];
        let claims = compute_ownership_claims(&holders, 1_000, 4_000, 6_000, 0);
        assert_eq!(claims[0].amount, 1_000);
        assert_eq!(claims[1].amount, 0);
    }

    #[test]
    fn ownership_claims_remainder_to_largest_effective_holder() {
        let holders = [
            OwnershipHolder {
                contribution_weight: 0,
                index: 0,
                is_author: true,
            },
            OwnershipHolder {
                contribution_weight: 1,
                index: 1,
                is_author: false,
            },
            OwnershipHolder {
                contribution_weight: 1,
                index: 2,
                is_author: false,
            },
        ];
        let claims = compute_ownership_claims(&holders, 101, 4_000, 6_000, 2);
        assert_eq!(claims[0].amount, 41);
        assert_eq!(claims[1].amount, 30);
        assert_eq!(claims[2].amount, 30);
        assert_eq!(claims.iter().map(|c| c.amount).sum::<u64>(), 101);
    }

    #[test]
    fn ownership_claims_empty_and_zero_revenue() {
        assert!(compute_ownership_claims(&[], 100, 4_000, 6_000, 2).is_empty());

        let holders = [OwnershipHolder {
            contribution_weight: 0,
            index: 0,
            is_author: true,
        }];
        let claims = compute_ownership_claims(&holders, 0, 10_000, 0, 0);
        assert_eq!(claims, vec![Claim { index: 0, amount: 0 }]);
    }
}
