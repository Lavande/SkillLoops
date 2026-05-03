use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::{
    error::SlpError,
    events::*,
    math::{compute_ownership_claims, OwnershipHolder},
    state::*,
};

#[derive(Accounts)]
pub struct SettlePeriod<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub skill: Account<'info, Skill>,

    #[account(
        mut,
        seeds = [RevenuePool::SEED_PREFIX, skill.key().as_ref()],
        bump = pool.bump,
        has_one = skill,
    )]
    pub pool: Account<'info, RevenuePool>,

    #[account(
        seeds = [ShareLedger::SEED_PREFIX, skill.key().as_ref()],
        bump = ledger.bump,
        has_one = skill,
    )]
    pub ledger: Account<'info, ShareLedger>,

    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler<'info>(
    ctx: Context<'_, '_, '_, 'info, SettlePeriod<'info>>,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let pool = &mut ctx.accounts.pool;
    let ledger = &ctx.accounts.ledger;
    let skill_key = ctx.accounts.skill.key();

    require!(
        now >= pool.current_period_start + pool.period_length,
        SlpError::PeriodNotElapsed
    );

    let next_snapshot_id = pool.snapshot_id + 1;
    let period_revenue = pool.current_period_revenue;

    if period_revenue == 0 {
        pool.current_period_revenue = 0;
        pool.current_period_start = now;
        pool.last_settlement_time = now;
        pool.snapshot_author_ownership_bps = ledger.author_ownership_bps;
        pool.snapshot_contributor_pool_bps = ledger.contributor_pool_bps;
        pool.snapshot_id = next_snapshot_id;
        emit!(PeriodSettled {
            skill: skill_key,
            snapshot_id: next_snapshot_id,
            period_revenue: 0,
            author_ownership_bps: ledger.author_ownership_bps,
            contributor_pool_bps: ledger.contributor_pool_bps,
        });
        return Ok(());
    }

    let remaining = ctx.remaining_accounts;
    require!(remaining.len() % 2 == 0, SlpError::SettleAccountsUnpaired);

    let mut holders: Vec<OwnershipHolder> = Vec::with_capacity(remaining.len() / 2);
    let mut sum_contributor_weight: u64 = 0;

    for (i, pair) in remaining.chunks(2).enumerate() {
        let share_ai = &pair[0];
        let claim_ai = &pair[1];

        let share: ShareAccount = ShareAccount::try_deserialize(&mut &share_ai.data.borrow()[..])?;
        require!(share.skill == skill_key, SlpError::ShareAccountMismatch);
        let is_author = share.holder == ctx.accounts.skill.author;
        if !is_author {
            require!(share.contribution_weight > 0, SlpError::SharesMustBeNonzero);
            sum_contributor_weight = sum_contributor_weight
                .checked_add(share.contribution_weight)
                .ok_or(error!(SlpError::HoldersIncomplete))?;
        }

        let (expected_share_pda, _) = Pubkey::find_program_address(
            &[
                ShareAccount::SEED_PREFIX,
                skill_key.as_ref(),
                share.holder.as_ref(),
            ],
            ctx.program_id,
        );
        require_keys_eq!(share_ai.key(), expected_share_pda, SlpError::ShareAccountMismatch);

        let (expected_claim_pda, _) = Pubkey::find_program_address(
            &[
                ClaimableRevenue::SEED_PREFIX,
                skill_key.as_ref(),
                share.holder.as_ref(),
                &next_snapshot_id.to_le_bytes(),
            ],
            ctx.program_id,
        );
        require_keys_eq!(claim_ai.key(), expected_claim_pda, SlpError::WrongClaimPda);

        holders.push(OwnershipHolder {
            contribution_weight: share.contribution_weight,
            index: i,
            is_author,
        });
    }

    require!(holders.iter().any(|h| h.is_author), SlpError::HoldersIncomplete);
    require_eq!(
        sum_contributor_weight,
        ledger.total_contributor_weight,
        SlpError::HoldersIncomplete
    );

    let claims = compute_ownership_claims(
        &holders,
        period_revenue,
        ledger.author_ownership_bps,
        ledger.contributor_pool_bps,
        ledger.total_contributor_weight,
    );

    let rent = &ctx.accounts.rent;
    let space = ClaimableRevenue::SPACE;
    let lamports = rent.minimum_balance(space);

    for (i, pair) in remaining.chunks(2).enumerate() {
        let share_ai = &pair[0];
        let claim_ai = &pair[1];

        let share: ShareAccount = ShareAccount::try_deserialize(&mut &share_ai.data.borrow()[..])?;
        let holder = share.holder;

        let (expected_claim_pda, claim_bump) = Pubkey::find_program_address(
            &[
                ClaimableRevenue::SEED_PREFIX,
                skill_key.as_ref(),
                holder.as_ref(),
                &next_snapshot_id.to_le_bytes(),
            ],
            ctx.program_id,
        );
        require_keys_eq!(claim_ai.key(), expected_claim_pda, SlpError::WrongClaimPda);

        let snapshot_id_bytes = next_snapshot_id.to_le_bytes();
        let seeds: &[&[u8]] = &[
            ClaimableRevenue::SEED_PREFIX,
            skill_key.as_ref(),
            holder.as_ref(),
            &snapshot_id_bytes,
            &[claim_bump],
        ];
        let signer_seeds = &[seeds];

        let cpi = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::CreateAccount {
                from: ctx.accounts.payer.to_account_info(),
                to: claim_ai.clone(),
            },
            signer_seeds,
        );
        system_program::create_account(cpi, lamports, space as u64, ctx.program_id)?;

        let amount = claims[i].amount;
        let data = ClaimableRevenue {
            holder,
            skill: skill_key,
            amount,
            snapshot_id: next_snapshot_id,
            bump: claim_bump,
        };
        let mut writer = &mut claim_ai.try_borrow_mut_data()?[..];
        data.try_serialize(&mut writer)?;
    }

    pool.total_lifetime_revenue = pool.total_lifetime_revenue.saturating_add(period_revenue);
    pool.current_period_revenue = 0;
    pool.current_period_start = now;
    pool.last_settlement_time = now;
    pool.snapshot_author_ownership_bps = ledger.author_ownership_bps;
    pool.snapshot_contributor_pool_bps = ledger.contributor_pool_bps;
    pool.snapshot_id = next_snapshot_id;

    emit!(PeriodSettled {
        skill: skill_key,
        snapshot_id: next_snapshot_id,
        period_revenue,
        author_ownership_bps: ledger.author_ownership_bps,
        contributor_pool_bps: ledger.contributor_pool_bps,
    });
    Ok(())
}
