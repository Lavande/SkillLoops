use anchor_lang::prelude::*;
use crate::{error::SlpError, events::*, state::*};

#[derive(Accounts)]
pub struct ClaimRevenue<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    pub skill: Account<'info, Skill>,

    #[account(
        mut,
        seeds = [RevenuePool::SEED_PREFIX, skill.key().as_ref()],
        bump = pool.bump,
        has_one = skill,
    )]
    pub pool: Account<'info, RevenuePool>,

    #[account(
        mut,
        close = holder,
        seeds = [
            ClaimableRevenue::SEED_PREFIX,
            skill.key().as_ref(),
            holder.key().as_ref(),
            &claimable.snapshot_id.to_le_bytes(),
        ],
        bump = claimable.bump,
        has_one = holder,
        has_one = skill,
    )]
    pub claimable: Account<'info, ClaimableRevenue>,

    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<ClaimRevenue>) -> Result<()> {
    let amount = ctx.accounts.claimable.amount;
    require!(amount > 0, SlpError::NothingToClaim);

    let pool_info = ctx.accounts.pool.to_account_info();
    let rent_min = ctx.accounts.rent.minimum_balance(pool_info.data_len());
    let pool_lamports = **pool_info.try_borrow_lamports()?;
    require!(
        pool_lamports.saturating_sub(amount) >= rent_min,
        SlpError::PoolBelowRentExempt
    );

    **pool_info.try_borrow_mut_lamports()? = pool_lamports - amount;
    **ctx.accounts.holder.to_account_info().try_borrow_mut_lamports()? =
        ctx.accounts.holder.to_account_info().lamports() + amount;

    let snapshot_id = ctx.accounts.claimable.snapshot_id;
    emit!(RevenueClaimed {
        skill: ctx.accounts.skill.key(),
        holder: ctx.accounts.holder.key(),
        amount,
        snapshot_id,
    });

    Ok(())
}
