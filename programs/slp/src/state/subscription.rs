use anchor_lang::prelude::*;

#[account]
pub struct Subscription {
    pub subscriber: Pubkey,
    pub skill: Pubkey,
    pub start_time: i64,
    pub expiry_time: i64,
    pub total_calls: u64,
    pub is_active: bool,
    pub bump: u8,
}

impl Subscription {
    pub const SPACE: usize = 8 + 32 + 32 + 8 + 8 + 8 + 1 + 1;
    pub const SEED_PREFIX: &'static [u8] = b"sub";
}
