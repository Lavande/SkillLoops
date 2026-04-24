use anchor_lang::prelude::*;
use crate::constants::*;

#[account]
pub struct Skill {
    pub author: Pubkey,
    pub name: String,                // max MAX_NAME_LEN
    pub description: String,         // max MAX_DESCRIPTION_LEN
    pub category: String,            // max MAX_CATEGORY_LEN
    pub current_version: u32,
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,       // max MAX_ARWEAVE_TX_ID_LEN
    pub subscription_price: u64,
    pub min_author_ratio_bps: u16,
    pub k: u16,
    pub created_at: i64,
    pub updated_at: i64,
    pub subscriber_count: u32,
    pub total_revenue: u64,
    pub next_experience_id: u64,
    pub name_hash: [u8; 16],          // first 16 bytes of sha256(name) — stored for audit/reseed
    pub bump: u8,
}

impl Skill {
    pub const SPACE: usize = 8                              // discriminator
        + 32                                                 // author
        + (4 + MAX_NAME_LEN)                                 // name
        + (4 + MAX_DESCRIPTION_LEN)                          // description
        + (4 + MAX_CATEGORY_LEN)                             // category
        + 4                                                  // current_version
        + 32                                                 // content_hash
        + (4 + MAX_ARWEAVE_TX_ID_LEN)                        // arweave_tx_id
        + 8                                                  // subscription_price
        + 2                                                  // min_author_ratio_bps
        + 2                                                  // k
        + 8                                                  // created_at
        + 8                                                  // updated_at
        + 4                                                  // subscriber_count
        + 8                                                  // total_revenue
        + 8                                                  // next_experience_id
        + 16                                                 // name_hash
        + 1;                                                 // bump
    pub const SEED_PREFIX: &'static [u8] = b"skill";
}

#[account]
pub struct SkillVersion {
    pub skill: Pubkey,
    pub version: u32,
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,                   // max MAX_ARWEAVE_TX_ID_LEN
    pub contributing_experience_ids: Vec<u64>,   // max MAX_CONTRIBUTORS_PER_VERSION
    pub published_at: i64,
    pub bump: u8,
}

impl SkillVersion {
    pub const SPACE: usize = 8
        + 32
        + 4
        + 32
        + (4 + MAX_ARWEAVE_TX_ID_LEN)
        + (4 + MAX_CONTRIBUTORS_PER_VERSION * 8)
        + 8
        + 1;
    pub const SEED_PREFIX: &'static [u8] = b"version";
}
