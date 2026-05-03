use anchor_lang::prelude::*;
use crate::constants::*;

#[account]
pub struct ExperienceRecord {
    pub experience_id: u64,
    pub skill: Pubkey,
    pub contributor: Pubkey,
    pub skill_version: u32,
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,         // max MAX_ARWEAVE_TX_ID_LEN
    pub status: u8,                    // STATUS_PENDING / STATUS_EVALUATED / STATUS_REJECTED
    pub contribution_score: u8,
    pub contribution_weight_delta: u64,
    pub ownership_delta_bps: u16,
    pub submitted_at: i64,
    pub evaluated_at: i64,
    pub judge_report_tx_id: String,    // max MAX_ARWEAVE_TX_ID_LEN
    pub bump: u8,
}

impl ExperienceRecord {
    pub const SPACE: usize = 8
        + 8
        + 32
        + 32
        + 4
        + 32
        + (4 + MAX_ARWEAVE_TX_ID_LEN)
        + 1
        + 1
        + 8
        + 2
        + 8
        + 8
        + (4 + MAX_ARWEAVE_TX_ID_LEN)
        + 1;
    pub const SEED_PREFIX: &'static [u8] = b"exp";
}
