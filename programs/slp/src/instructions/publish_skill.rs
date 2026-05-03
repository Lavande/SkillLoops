use anchor_lang::prelude::*;
use crate::{constants::*, error::SlpError, events::*, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PublishSkillArgs {
    pub name: String,
    pub description: String,
    pub category: String,
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,
    pub subscription_price: u64,
    pub min_author_ratio_bps: u16,
    pub k: u16,
    pub period_length: i64,
    pub name_hash: [u8; 16],
}

#[derive(Accounts)]
#[instruction(args: PublishSkillArgs)]
pub struct PublishSkill<'info> {
    #[account(mut)]
    pub author: Signer<'info>,

    #[account(
        init,
        payer = author,
        space = Skill::SPACE,
        seeds = [Skill::SEED_PREFIX, author.key().as_ref(), args.name_hash.as_ref()],
        bump,
    )]
    pub skill: Account<'info, Skill>,

    #[account(
        init,
        payer = author,
        space = SkillVersion::SPACE,
        seeds = [SkillVersion::SEED_PREFIX, skill.key().as_ref(), &1u32.to_le_bytes()],
        bump,
    )]
    pub version: Account<'info, SkillVersion>,

    #[account(
        init,
        payer = author,
        space = ShareLedger::SPACE,
        seeds = [ShareLedger::SEED_PREFIX, skill.key().as_ref()],
        bump,
    )]
    pub ledger: Account<'info, ShareLedger>,

    #[account(
        init,
        payer = author,
        space = RevenuePool::SPACE,
        seeds = [RevenuePool::SEED_PREFIX, skill.key().as_ref()],
        bump,
    )]
    pub pool: Account<'info, RevenuePool>,

    #[account(
        init,
        payer = author,
        space = ShareAccount::SPACE,
        seeds = [ShareAccount::SEED_PREFIX, skill.key().as_ref(), author.key().as_ref()],
        bump,
    )]
    pub author_share: Account<'info, ShareAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PublishSkill>, args: PublishSkillArgs) -> Result<()> {
    require!(args.subscription_price > 0, SlpError::ZeroPrice);
    require!(
        args.min_author_ratio_bps >= MIN_AUTHOR_RATIO_BPS_FLOOR
            && args.min_author_ratio_bps <= 10_000,
        SlpError::FloorTooLow
    );
    require!(args.k >= K_MIN && args.k <= K_MAX, SlpError::InvalidK);
    require!(args.name.len() <= MAX_NAME_LEN, SlpError::StringTooLong);
    require!(args.description.len() <= MAX_DESCRIPTION_LEN, SlpError::StringTooLong);
    require!(args.category.len() <= MAX_CATEGORY_LEN, SlpError::StringTooLong);
    require!(args.arweave_tx_id.len() <= MAX_ARWEAVE_TX_ID_LEN, SlpError::StringTooLong);
    require!(args.period_length > 0, SlpError::PeriodNotElapsed);

    let now = Clock::get()?.unix_timestamp;

    let skill = &mut ctx.accounts.skill;
    skill.author = ctx.accounts.author.key();
    skill.name = args.name.clone();
    skill.description = args.description.clone();
    skill.category = args.category.clone();
    skill.current_version = 1;
    skill.content_hash = args.content_hash;
    skill.arweave_tx_id = args.arweave_tx_id.clone();
    skill.subscription_price = args.subscription_price;
    skill.min_author_ratio_bps = args.min_author_ratio_bps;
    skill.k = args.k;
    skill.created_at = now;
    skill.updated_at = now;
    skill.subscriber_count = 0;
    skill.total_revenue = 0;
    skill.next_experience_id = 0;
    skill.name_hash = args.name_hash;
    skill.bump = ctx.bumps.skill;

    let version = &mut ctx.accounts.version;
    version.skill = skill.key();
    version.version = 1;
    version.content_hash = args.content_hash;
    version.arweave_tx_id = args.arweave_tx_id.clone();
    version.contributing_experience_ids = Vec::new();
    version.published_at = now;
    version.bump = ctx.bumps.version;

    let ledger = &mut ctx.accounts.ledger;
    ledger.skill = skill.key();
    ledger.author_ownership_bps = OWNERSHIP_BPS;
    ledger.contributor_pool_bps = 0;
    ledger.min_author_ratio_bps = args.min_author_ratio_bps;
    ledger.total_contributor_weight = 0;
    ledger.contributor_count = 0;
    ledger.points_per_100bps = POINTS_PER_100BPS_DEFAULT;
    ledger.max_pool_increase_per_evaluation_bps = MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT;
    ledger.last_snapshot_time = now;
    ledger.bump = ctx.bumps.ledger;

    let pool = &mut ctx.accounts.pool;
    pool.skill = skill.key();
    pool.current_period_revenue = 0;
    pool.total_lifetime_revenue = 0;
    pool.current_period_start = now;
    pool.period_length = args.period_length;
    pool.snapshot_author_ownership_bps = OWNERSHIP_BPS;
    pool.snapshot_contributor_pool_bps = 0;
    pool.snapshot_id = 0;
    pool.last_settlement_time = 0;
    pool.bump = ctx.bumps.pool;

    let author_share = &mut ctx.accounts.author_share;
    author_share.holder = ctx.accounts.author.key();
    author_share.skill = skill.key();
    author_share.contribution_weight = 0;
    author_share.lock_until = 0;
    author_share.first_contribution_at = 0;
    author_share.last_contribution_at = 0;
    author_share.bump = ctx.bumps.author_share;

    emit!(SkillPublished {
        skill: skill.key(),
        author: ctx.accounts.author.key(),
        created_at: now,
    });
    Ok(())
}
