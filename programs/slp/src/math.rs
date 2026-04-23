// Pure arithmetic for the SLP protocol. no_std-safe; does not use anchor_lang.
// Mirrors lib/domain/shares.ts and lib/domain/revenue.ts.

#[derive(Clone, Copy, Debug)]
pub struct MintInput {
    pub score: u8,
    pub k: u16,
    pub author_shares: u64,
    pub total_shares: u64,
    pub min_author_ratio_bps: u16,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MintOutput {
    pub shares_to_mint: u64,
    pub floor_hit: bool,
}

pub fn mint_contribution_shares(i: MintInput) -> MintOutput {
    let base_shares = (i.score as u64).saturating_mul(i.k as u64);

    // max_total = author_shares * 10_000 / min_author_ratio_bps (u128 intermediate).
    let max_total = (i.author_shares as u128)
        .saturating_mul(10_000u128)
        .checked_div(i.min_author_ratio_bps as u128)
        .unwrap_or(u128::MAX);
    let max_total_u64 = max_total.min(u64::MAX as u128) as u64;

    let headroom = max_total_u64.saturating_sub(i.total_shares);
    let shares_to_mint = base_shares.min(headroom);

    MintOutput {
        shares_to_mint,
        floor_hit: shares_to_mint < base_shares,
    }
}

#[derive(Clone, Copy, Debug)]
pub struct Holder {
    pub shares: u64,
    pub index: usize,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Claim {
    pub index: usize,
    pub amount: u64,
}

pub fn compute_claims(
    holders: &[Holder],
    period_revenue: u64,
    total_shares: u64,
) -> Vec<Claim> {
    if holders.is_empty() {
        return Vec::new();
    }
    if total_shares == 0 || period_revenue == 0 {
        return holders.iter()
            .map(|h| Claim { index: h.index, amount: 0 })
            .collect();
    }

    let mut claims: Vec<Claim> = holders.iter().map(|h| {
        let amount = ((period_revenue as u128) * (h.shares as u128)
                      / (total_shares as u128)) as u64;
        Claim { index: h.index, amount }
    }).collect();

    let distributed: u64 = claims.iter().map(|c| c.amount).sum();
    let remainder = period_revenue.saturating_sub(distributed);

    if remainder > 0 {
        // Largest shares wins; ties broken by smallest original position.
        let mut best_pos: usize = 0;
        for i in 1..holders.len() {
            let (bh, ph) = (holders[best_pos], holders[i]);
            if ph.shares > bh.shares {
                best_pos = i;
            }
            // No else — equal or smaller leaves best_pos unchanged (preserves first-win).
        }
        claims[best_pos].amount = claims[best_pos].amount.saturating_add(remainder);
    }

    claims
}

#[cfg(test)]
mod tests {
    use super::*;

    // ---- mint_contribution_shares ----

    #[test]
    fn mint_prd_demo() {
        // score=38, k=10, author=1000, total=1000, bps=4000 (40% floor)
        let out = mint_contribution_shares(MintInput {
            score: 38, k: 10, author_shares: 1000,
            total_shares: 1000, min_author_ratio_bps: 4000,
        });
        assert_eq!(out, MintOutput { shares_to_mint: 380, floor_hit: false });
    }

    #[test]
    fn mint_floor_hit() {
        // Pre-state just under the floor: total=2400, author=1000, bps=4000 => max_total=2500 => headroom=100.
        // base = 50*10 = 500. Expect clamp to 100, floor_hit=true.
        let out = mint_contribution_shares(MintInput {
            score: 50, k: 10, author_shares: 1000,
            total_shares: 2400, min_author_ratio_bps: 4000,
        });
        assert_eq!(out, MintOutput { shares_to_mint: 100, floor_hit: true });
    }

    #[test]
    fn mint_threshold_boundary() {
        // score == MIN_APPROVE_SCORE (20). Caller enforces threshold; math returns 200.
        let out = mint_contribution_shares(MintInput {
            score: 20, k: 10, author_shares: 1000,
            total_shares: 1000, min_author_ratio_bps: 4000,
        });
        assert_eq!(out, MintOutput { shares_to_mint: 200, floor_hit: false });
    }

    #[test]
    fn mint_zero_k() {
        let out = mint_contribution_shares(MintInput {
            score: 38, k: 0, author_shares: 1000,
            total_shares: 1000, min_author_ratio_bps: 4000,
        });
        assert_eq!(out, MintOutput { shares_to_mint: 0, floor_hit: false });
    }

    #[test]
    fn mint_post_ratio_invariant() {
        // For any valid input, author/(total + minted) must stay >= floor_bps.
        let cases = [
            (38u8, 10u16, 1000u64, 1000u64, 4000u16),
            (50, 10, 1000, 2400, 4000),
            (42, 15, 500,  500,  5000),
            (20, 10, 10_000, 20_000, 3000),
            (1,  10, 1000, 1000, 3000),
        ];
        for (score, k, author, total, bps) in cases {
            let out = mint_contribution_shares(MintInput {
                score, k, author_shares: author,
                total_shares: total, min_author_ratio_bps: bps,
            });
            let new_total = total + out.shares_to_mint;
            // author/new_total >= bps/10000 ⇔ author*10000 >= bps*new_total.
            let lhs = (author as u128) * 10_000;
            let rhs = (bps as u128) * (new_total as u128);
            assert!(
                lhs >= rhs,
                "invariant broken: score={score} k={k} author={author} total={total} bps={bps} minted={}",
                out.shares_to_mint
            );
        }
    }

    #[test]
    fn mint_large_numbers_no_panic() {
        let out = mint_contribution_shares(MintInput {
            score: 50, k: 100,
            author_shares: 1_000_000_000,
            total_shares: 1_000_000_000,
            min_author_ratio_bps: 3000,
        });
        // 5000 shares base, plenty of headroom.
        assert_eq!(out.shares_to_mint, 5000);
        assert!(!out.floor_hit);
    }

    // ---- compute_claims ----

    #[test]
    fn claims_prd_demo_100m() {
        // Alice=1000, Bob=380, revenue=100_000_000, total=1380
        let holders = [
            Holder { shares: 1000, index: 0 },
            Holder { shares: 380, index: 1 },
        ];
        let claims = compute_claims(&holders, 100_000_000, 1380);
        assert_eq!(claims.len(), 2);
        assert_eq!(claims[0], Claim { index: 0, amount: 72_463_769 });
        assert_eq!(claims[1], Claim { index: 1, amount: 27_536_231 });
        assert_eq!(claims[0].amount + claims[1].amount, 100_000_000);
    }

    #[test]
    fn claims_prd_full_demo_200m() {
        // Same holders, revenue=200_000_000 (matches Slice 1 Vitest output).
        let holders = [
            Holder { shares: 1000, index: 0 },
            Holder { shares: 380, index: 1 },
        ];
        let claims = compute_claims(&holders, 200_000_000, 1380);
        assert_eq!(claims[0].amount, 144_927_537);
        assert_eq!(claims[1].amount, 55_072_463);
        assert_eq!(claims[0].amount + claims[1].amount, 200_000_000);
    }

    #[test]
    fn claims_skip_zero_share_third_holder() {
        // Carol has 0 shares — she should get 0.
        let holders = [
            Holder { shares: 1000, index: 0 },
            Holder { shares: 380, index: 1 },
            Holder { shares: 0,    index: 2 },
        ];
        let claims = compute_claims(&holders, 100_000_000, 1380);
        assert_eq!(claims[0].amount, 72_463_769);
        assert_eq!(claims[1].amount, 27_536_231);
        assert_eq!(claims[2].amount, 0);
    }

    #[test]
    fn claims_single_holder_gets_full() {
        let holders = [Holder { shares: 1000, index: 0 }];
        let claims = compute_claims(&holders, 100_000_000, 1000);
        assert_eq!(claims[0].amount, 100_000_000);
    }

    #[test]
    fn claims_three_way_tie_remainder_to_index_0() {
        // Equal shares; 100 / 3 = 33 each, remainder 1 goes to the first holder.
        let holders = [
            Holder { shares: 100, index: 0 },
            Holder { shares: 100, index: 1 },
            Holder { shares: 100, index: 2 },
        ];
        let claims = compute_claims(&holders, 100, 300);
        assert_eq!(claims[0].amount, 34);
        assert_eq!(claims[1].amount, 33);
        assert_eq!(claims[2].amount, 33);
        assert_eq!(claims.iter().map(|c| c.amount).sum::<u64>(), 100);
    }

    #[test]
    fn claims_degenerate_cases() {
        // Empty holders.
        assert!(compute_claims(&[], 100, 1000).is_empty());

        // Zero total shares.
        let hs = [Holder { shares: 1000, index: 0 }];
        let out = compute_claims(&hs, 100, 0);
        assert_eq!(out, vec![Claim { index: 0, amount: 0 }]);

        // Zero revenue.
        let out = compute_claims(&hs, 0, 1000);
        assert_eq!(out, vec![Claim { index: 0, amount: 0 }]);
    }
}
