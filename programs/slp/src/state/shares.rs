use anchor_lang::prelude::*;

#[account]
pub struct ShareLedger {
    pub skill: Pubkey,
    pub total_shares: u64,
    pub author_shares: u64,
    pub min_author_ratio_bps: u16,
    pub contributor_count: u32,
    pub last_snapshot_time: i64,
    pub bump: u8,
}

impl ShareLedger {
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 2 + 4 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"ledger";
}

#[account]
pub struct ShareAccount {
    pub holder: Pubkey,
    pub skill: Pubkey,
    pub shares: u64,
    pub lock_until: i64,
    pub first_contribution_at: i64,
    pub last_contribution_at: i64,
    pub bump: u8,
}

impl ShareAccount {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"share";
}
