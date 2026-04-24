use anchor_lang::prelude::*;

#[event]
pub struct SkillPublished {
    pub skill: Pubkey,
    pub author: Pubkey,
    pub created_at: i64,
}

#[event]
pub struct Subscribed {
    pub skill: Pubkey,
    pub subscriber: Pubkey,
    pub expiry_time: i64,
}

#[event]
pub struct ExperienceSubmitted {
    pub skill: Pubkey,
    pub experience_id: u64,
    pub contributor: Pubkey,
}

#[event]
pub struct ExperienceEvaluated {
    pub skill: Pubkey,
    pub experience_id: u64,
    pub score: u8,
    pub shares_minted: u64,
    pub approved: bool,
    pub floor_hit: bool,
}

#[event]
pub struct SharesMinted {
    pub skill: Pubkey,
    pub holder: Pubkey,
    pub amount: u64,
    pub total_shares_after: u64,
}

#[event]
pub struct PeriodSettled {
    pub skill: Pubkey,
    pub snapshot_id: u64,
    pub period_revenue: u64,
    pub total_shares: u64,
}

#[event]
pub struct RevenueClaimed {
    pub skill: Pubkey,
    pub holder: Pubkey,
    pub amount: u64,
    pub snapshot_id: u64,
}

#[event]
pub struct VersionPublished {
    pub skill: Pubkey,
    pub version: u32,
    pub contributing_count: u32,
}
