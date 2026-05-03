use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::{constants::*, events::*, state::*};

#[derive(Accounts)]
pub struct Subscribe<'info> {
    #[account(mut)]
    pub subscriber: Signer<'info>,

    #[account(mut)]
    pub skill: Account<'info, Skill>,

    #[account(
        mut,
        seeds = [RevenuePool::SEED_PREFIX, skill.key().as_ref()],
        bump = pool.bump,
        has_one = skill,
    )]
    pub pool: Account<'info, RevenuePool>,

    #[account(
        init_if_needed,
        payer = subscriber,
        space = Subscription::SPACE,
        seeds = [Subscription::SEED_PREFIX, skill.key().as_ref(), subscriber.key().as_ref()],
        bump,
    )]
    pub subscription: Account<'info, Subscription>,

    #[account(
        init_if_needed,
        payer = subscriber,
        space = ShareAccount::SPACE,
        seeds = [ShareAccount::SEED_PREFIX, skill.key().as_ref(), subscriber.key().as_ref()],
        bump,
    )]
    pub share_account: Account<'info, ShareAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Subscribe>) -> Result<()> {
    let price = ctx.accounts.skill.subscription_price;
    let now = Clock::get()?.unix_timestamp;

    let cpi = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        system_program::Transfer {
            from: ctx.accounts.subscriber.to_account_info(),
            to: ctx.accounts.pool.to_account_info(),
        },
    );
    system_program::transfer(cpi, price)?;

    let sub = &mut ctx.accounts.subscription;
    let is_new_or_expired = sub.subscriber == Pubkey::default() || !sub.is_active || sub.expiry_time <= now;
    if is_new_or_expired {
        sub.subscriber = ctx.accounts.subscriber.key();
        sub.skill = ctx.accounts.skill.key();
        sub.start_time = now;
        sub.expiry_time = now + SUBSCRIPTION_PERIOD_SECONDS;
        sub.total_calls = 0;
        sub.is_active = true;
        sub.bump = ctx.bumps.subscription;
        ctx.accounts.skill.subscriber_count = ctx.accounts.skill.subscriber_count.saturating_add(1);
    } else {
        sub.expiry_time = sub.expiry_time.saturating_add(SUBSCRIPTION_PERIOD_SECONDS);
    }

    let share = &mut ctx.accounts.share_account;
    if share.holder == Pubkey::default() {
        share.holder = ctx.accounts.subscriber.key();
        share.skill = ctx.accounts.skill.key();
        share.contribution_weight = 0;
        share.lock_until = 0;
        share.first_contribution_at = 0;
        share.last_contribution_at = 0;
        share.bump = ctx.bumps.share_account;
    }

    ctx.accounts.pool.current_period_revenue = ctx.accounts.pool.current_period_revenue.saturating_add(price);
    ctx.accounts.skill.total_revenue = ctx.accounts.skill.total_revenue.saturating_add(price);

    emit!(Subscribed {
        skill: ctx.accounts.skill.key(),
        subscriber: ctx.accounts.subscriber.key(),
        expiry_time: sub.expiry_time,
    });
    Ok(())
}
