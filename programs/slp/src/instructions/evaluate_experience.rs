use anchor_lang::prelude::*;
use crate::{
    constants::*,
    error::SlpError,
    events::*,
    math::{mint_contribution_shares, MintInput},
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
        exp.shares_minted = 0;
        exp.evaluated_at = now;
        exp.judge_report_tx_id = judge_report_tx_id;
        emit!(ExperienceEvaluated {
            skill: ctx.accounts.skill.key(),
            experience_id: exp.experience_id,
            score,
            shares_minted: 0,
            approved: false,
            floor_hit: false,
        });
        return Ok(());
    }

    let mint = mint_contribution_shares(MintInput {
        score,
        k: ctx.accounts.skill.k,
        author_shares: ledger.author_shares,
        total_shares: ledger.total_shares,
        min_author_ratio_bps: ledger.min_author_ratio_bps,
    });

    ledger.total_shares = ledger.total_shares.saturating_add(mint.shares_to_mint);
    ledger.last_snapshot_time = now;

    share.shares = share.shares.saturating_add(mint.shares_to_mint);
    if share.first_contribution_at == 0 && mint.shares_to_mint > 0 {
        share.first_contribution_at = now;
        ledger.contributor_count = ledger.contributor_count.saturating_add(1);
    }
    share.last_contribution_at = now;
    share.lock_until = now + LOCK_PERIOD_SECONDS;

    exp.status = STATUS_EVALUATED;
    exp.contribution_score = score;
    exp.shares_minted = mint.shares_to_mint;
    exp.evaluated_at = now;
    exp.judge_report_tx_id = judge_report_tx_id;

    emit!(ExperienceEvaluated {
        skill: ctx.accounts.skill.key(),
        experience_id: exp.experience_id,
        score,
        shares_minted: mint.shares_to_mint,
        approved: true,
        floor_hit: mint.floor_hit,
    });
    if mint.shares_to_mint > 0 {
        emit!(SharesMinted {
            skill: ctx.accounts.skill.key(),
            holder: exp.contributor,
            amount: mint.shares_to_mint,
            total_shares_after: ledger.total_shares,
        });
    }
    Ok(())
}
