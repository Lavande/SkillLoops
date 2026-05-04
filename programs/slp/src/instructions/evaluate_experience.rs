use anchor_lang::prelude::*;
use crate::{
    constants::*,
    error::SlpError,
    events::*,
    math::{evaluate_contribution_ownership, EvaluateOwnershipInput},
    state::*,
};

#[derive(Accounts)]
pub struct EvaluateExperience<'info> {
    pub judge: Signer<'info>,

    #[account(
        seeds = [ProtocolConfig::SEED_PREFIX],
        bump = config.bump,
        has_one = judge,
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub skill: Account<'info, Skill>,

    #[account(mut, has_one = skill)]
    pub experience: Account<'info, ExperienceRecord>,

    #[account(
        mut,
        seeds = [ShareLedger::SEED_PREFIX, skill.key().as_ref()],
        bump = ledger.bump,
        has_one = skill,
    )]
    pub ledger: Account<'info, ShareLedger>,

    #[account(
        mut,
        seeds = [
            ShareAccount::SEED_PREFIX,
            skill.key().as_ref(),
            experience.contributor.as_ref(),
        ],
        bump = contributor_share.bump,
        constraint = contributor_share.holder == experience.contributor @ SlpError::ShareAccountMismatch,
        constraint = contributor_share.skill == skill.key() @ SlpError::ShareAccountMismatch,
    )]
    pub contributor_share: Account<'info, ShareAccount>,
}

pub fn handler(ctx: Context<EvaluateExperience>, score: u8, judge_report_tx_id: String) -> Result<()> {
    require!(score <= MAX_SCORE, SlpError::ScoreOutOfRange);
    require!(
        judge_report_tx_id.len() <= MAX_ARWEAVE_TX_ID_LEN,
        SlpError::StringTooLong
    );
    require!(
        ctx.accounts.experience.status == STATUS_PENDING,
        SlpError::AlreadyEvaluated
    );

    let now = Clock::get()?.unix_timestamp;
    let exp = &mut ctx.accounts.experience;
    let ledger = &mut ctx.accounts.ledger;
    let share = &mut ctx.accounts.contributor_share;

    if score < MIN_APPROVE_SCORE {
        exp.status = STATUS_REJECTED;
        exp.contribution_score = score;
        exp.contribution_weight_delta = 0;
        exp.ownership_delta_bps = 0;
        exp.evaluated_at = now;
        exp.judge_report_tx_id = judge_report_tx_id;
        emit!(ExperienceEvaluated {
            skill: ctx.accounts.skill.key(),
            experience_id: exp.experience_id,
            contributor: exp.contributor,
            score,
            contribution_weight_delta: 0,
            ownership_delta_bps: 0,
            author_ownership_bps: ledger.author_ownership_bps,
            contributor_pool_bps: ledger.contributor_pool_bps,
            approved: false,
        });
        return Ok(());
    }

    let ownership = evaluate_contribution_ownership(EvaluateOwnershipInput {
        score,
        k: ctx.accounts.skill.k,
        author_ownership_bps: ledger.author_ownership_bps,
        contributor_pool_bps: ledger.contributor_pool_bps,
        min_author_ratio_bps: ledger.min_author_ratio_bps,
        total_contributor_weight: ledger.total_contributor_weight,
        contributor_count: ledger.contributor_count,
        contributor_weight: share.contribution_weight,
        points_per_100bps: ledger.points_per_100bps,
        max_pool_increase_per_evaluation_bps: ledger.max_pool_increase_per_evaluation_bps,
    });

    ledger.author_ownership_bps = ownership.author_ownership_bps;
    ledger.contributor_pool_bps = ownership.contributor_pool_bps;
    ledger.total_contributor_weight = ownership.total_contributor_weight;
    ledger.contributor_count = ownership.contributor_count;
    ledger.last_snapshot_time = now;

    share.contribution_weight = share
        .contribution_weight
        .saturating_add(ownership.contribution_weight_delta);
    if share.first_contribution_at == 0 && ownership.contribution_weight_delta > 0 {
        share.first_contribution_at = now;
    }
    share.last_contribution_at = now;
    share.lock_until = now + LOCK_PERIOD_SECONDS;

    exp.status = STATUS_EVALUATED;
    exp.contribution_score = score;
    exp.contribution_weight_delta = ownership.contribution_weight_delta;
    exp.ownership_delta_bps = ownership.ownership_delta_bps;
    exp.evaluated_at = now;
    exp.judge_report_tx_id = judge_report_tx_id;

    emit!(ExperienceEvaluated {
        skill: ctx.accounts.skill.key(),
        experience_id: exp.experience_id,
        contributor: exp.contributor,
        score,
        contribution_weight_delta: ownership.contribution_weight_delta,
        ownership_delta_bps: ownership.ownership_delta_bps,
        author_ownership_bps: ledger.author_ownership_bps,
        contributor_pool_bps: ledger.contributor_pool_bps,
        approved: true,
    });
    Ok(())
}
