use anchor_lang::prelude::*;

#[account]
pub struct ShareLedger {
    pub skill: Pubkey,
    pub author_ownership_bps: u16,
    pub contributor_pool_bps: u16,
    pub min_author_ratio_bps: u16,
    pub total_contributor_weight: u64,
    pub contributor_count: u32,
    pub points_per_100bps: u64,
    pub max_pool_increase_per_evaluation_bps: u16,
    pub last_snapshot_time: i64,
    pub bump: u8,
}

impl ShareLedger {
    pub const SPACE: usize = 8 + 32 + 2 + 2 + 2 + 8 + 4 + 8 + 2 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"ledger";
}

#[account]
pub struct ShareAccount {
    pub holder: Pubkey,
    pub skill: Pubkey,
    pub contribution_weight: u64,
    pub lock_until: i64,
    pub first_contribution_at: i64,
    pub last_contribution_at: i64,
    pub bump: u8,
}

impl ShareAccount {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"share";
}
