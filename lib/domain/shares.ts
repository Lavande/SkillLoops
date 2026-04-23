import { K_DEFAULT, MIN_APPROVE_SCORE } from "./thresholds";

export interface ShareLedgerState {
  total_shares: number;
  author_shares: number;
  min_author_ratio_bps: number;
  contributor_count: number;
}

export interface MintInput {
  score: number;
  k?: number;
  ledger: ShareLedgerState;
  contributorIsNew: boolean;
}

export interface MintResult {
  sharesToMint: number;
  newLedger: ShareLedgerState;
  floorHit: boolean;
}

/**
 * Share minting with author-floor protection.
 *
 *   base_shares = score * k
 *   max_total   = author_shares * 10000 / min_author_ratio_bps
 *   actual_new  = min(base_shares, max_total - total_shares)
 *
 * Matches PRD §5.6 and Appendix B exactly.
 */
export function mintContributionShares({
  score,
  k = K_DEFAULT,
  ledger,
  contributorIsNew,
}: MintInput): MintResult {
  if (score < MIN_APPROVE_SCORE) {
    return {
      sharesToMint: 0,
      newLedger: ledger,
      floorHit: false,
    };
  }
  const baseShares = score * k;
  // Integer-safe: (author_shares * 10000) / bps
  const maxTotal = Math.floor((ledger.author_shares * 10000) / ledger.min_author_ratio_bps);
  const headroom = Math.max(0, maxTotal - ledger.total_shares);
  const sharesToMint = Math.min(baseShares, headroom);
  return {
    sharesToMint,
    newLedger: {
      ...ledger,
      total_shares: ledger.total_shares + sharesToMint,
      contributor_count: ledger.contributor_count + (contributorIsNew && sharesToMint > 0 ? 1 : 0),
    },
    floorHit: sharesToMint < baseShares,
  };
}
