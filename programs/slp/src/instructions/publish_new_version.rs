use anchor_lang::prelude::*;
use crate::{constants::*, error::SlpError, events::*, state::*};

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PublishNewVersionArgs {
    pub content_hash: [u8; 32],
    pub arweave_tx_id: String,
    pub contributing_experience_ids: Vec<u64>,
}

#[derive(Accounts)]
#[instruction(args: PublishNewVersionArgs)]
pub struct PublishNewVersion<'info> {
    #[account(mut)]
    pub author: Signer<'info>,

    #[account(mut, has_one = author @ SlpError::NotAuthor)]
    pub skill: Account<'info, Skill>,

    #[account(
        init,
        payer = author,
        space = SkillVersion::SPACE,
        seeds = [
            SkillVersion::SEED_PREFIX,
            skill.key().as_ref(),
            &(skill.current_version + 1).to_le_bytes(),
        ],
        bump,
    )]
    pub new_version: Account<'info, SkillVersion>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<PublishNewVersion>, args: PublishNewVersionArgs) -> Result<()> {
    require!(args.arweave_tx_id.len() <= MAX_ARWEAVE_TX_ID_LEN, SlpError::StringTooLong);
    require!(
        args.contributing_experience_ids.len() <= MAX_CONTRIBUTORS_PER_VERSION,
        SlpError::TooManyContributors
    );

    let now = Clock::get()?.unix_timestamp;
    let skill = &mut ctx.accounts.skill;
    let new_version_num = skill.current_version + 1;
    let count = args.contributing_experience_ids.len() as u32;

    let v = &mut ctx.accounts.new_version;
    v.skill = skill.key();
    v.version = new_version_num;
    v.content_hash = args.content_hash;
    v.arweave_tx_id = args.arweave_tx_id.clone();
    v.contributing_experience_ids = args.contributing_experience_ids;
    v.published_at = now;
    v.bump = ctx.bumps.new_version;

    skill.current_version = new_version_num;
    skill.content_hash = args.content_hash;
    skill.arweave_tx_id = args.arweave_tx_id;
    skill.updated_at = now;

    emit!(VersionPublished {
        skill: skill.key(),
        version: new_version_num,
        contributing_count: count,
    });
    Ok(())
}
