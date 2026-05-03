use anchor_lang::prelude::*;

#[account]
pub struct RevenuePool {
    pub skill: Pubkey,
    pub current_period_revenue: u64,
    pub total_lifetime_revenue: u64,
    pub current_period_start: i64,
    pub period_length: i64,
    pub snapshot_author_ownership_bps: u16,
    pub snapshot_contributor_pool_bps: u16,
    pub snapshot_id: u64,
    pub last_settlement_time: i64,
    pub bump: u8,
}

impl RevenuePool {
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 8 + 2 + 2 + 8 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"pool";
}

#[account]
pub struct ClaimableRevenue {
    pub holder: Pubkey,
    pub skill: Pubkey,
    pub amount: u64,
    pub snapshot_id: u64,
    pub bump: u8,
}

impl ClaimableRevenue {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"claim";
}
