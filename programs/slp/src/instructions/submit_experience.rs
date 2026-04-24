use anchor_lang::prelude::*;
use crate::{constants::*, error::SlpError, events::*, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct SubmitExperienceArgs {
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,
    pub skill_version: u32,
}

#[derive(Accounts)]
pub struct SubmitExperience<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,

    #[account(mut)]
    pub skill: Account<'info, Skill>,

    #[account(
        init,
        payer = contributor,
        space = ExperienceRecord::SPACE,
        seeds = [
            ExperienceRecord::SEED_PREFIX,
            skill.key().as_ref(),
            &skill.next_experience_id.to_le_bytes(),
        ],
        bump,
    )]
    pub experience: Account<'info, ExperienceRecord>,

    #[account(
        init_if_needed,
        payer = contributor,
        space = ShareAccount::SPACE,
        seeds = [ShareAccount::SEED_PREFIX, skill.key().as_ref(), contributor.key().as_ref()],
        bump,
    )]
    pub contributor_share: Account<'info, ShareAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<SubmitExperience>, args: SubmitExperienceArgs) -> Result<()> {
    require!(args.arweave_tx_id.len() <= MAX_ARWEAVE_TX_ID_LEN, SlpError::StringTooLong);

    let now = Clock::get()?.unix_timestamp;
    let experience_id = ctx.accounts.skill.next_experience_id;

    let exp = &mut ctx.accounts.experience;
    exp.experience_id = experience_id;
    exp.skill = ctx.accounts.skill.key();
    exp.contributor = ctx.accounts.contributor.key();
    exp.skill_version = args.skill_version;
    exp.content_hash = args.content_hash;
    exp.arweave_tx_id = args.arweave_tx_id;
    exp.status = STATUS_PENDING;
    exp.contribution_score = 0;
    exp.shares_minted = 0;
    exp.submitted_at = now;
    exp.evaluated_at = 0;
    exp.judge_report_tx_id = String::new();
    exp.bump = ctx.bumps.experience;

    let share = &mut ctx.accounts.contributor_share;
    if share.holder == Pubkey::default() {
        share.holder = ctx.accounts.contributor.key();
        share.skill = ctx.accounts.skill.key();
        share.shares = 0;
        share.lock_until = 0;
        share.first_contribution_at = 0;
        share.last_contribution_at = 0;
        share.bump = ctx.bumps.contributor_share;
    }

    ctx.accounts.skill.next_experience_id = ctx.accounts.skill.next_experience_id
        .checked_add(1)
        .ok_or(error!(SlpError::StringTooLong))?;

    emit!(ExperienceSubmitted {
        skill: ctx.accounts.skill.key(),
        experience_id,
        contributor: ctx.accounts.contributor.key(),
    });
    Ok(())
}
