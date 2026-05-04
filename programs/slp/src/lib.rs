use anchor_lang::prelude::*;

declare_id!("BvgbBSJtRR8o6t6BpHVCGXymqgCwYSSWqneETJDdRU9t");

pub mod constants;
pub mod error;
pub mod events;
pub mod math;
pub mod state;
pub mod instructions;

use instructions::*;

#[program]
pub mod slp {
    use super::*;

    pub fn initialize_protocol(ctx: Context<InitializeProtocol>, judge: Pubkey) -> Result<()> {
        instructions::initialize_protocol::handler(ctx, judge)
    }

    pub fn publish_skill(
        ctx: Context<PublishSkill>,
        args: PublishSkillArgs,
    ) -> Result<()> {
        instructions::publish_skill::handler(ctx, args)
    }

    pub fn subscribe(ctx: Context<Subscribe>) -> Result<()> {
        instructions::subscribe::handler(ctx)
    }

    pub fn submit_experience(
        ctx: Context<SubmitExperience>,
        args: SubmitExperienceArgs,
    ) -> Result<()> {
        instructions::submit_experience::handler(ctx, args)
    }

    pub fn evaluate_experience(
        ctx: Context<EvaluateExperience>,
        score: u8,
        judge_report_tx_id: String,
    ) -> Result<()> {
        instructions::evaluate_experience::handler(ctx, score, judge_report_tx_id)
    }

    pub fn settle_period<'info>(ctx: Context<'_, '_, '_, 'info, SettlePeriod<'info>>) -> Result<()> {
        instructions::settle_period::handler(ctx)
    }

    pub fn claim_revenue(ctx: Context<ClaimRevenue>) -> Result<()> {
        instructions::claim_revenue::handler(ctx)
    }

    pub fn publish_new_version(
        ctx: Context<PublishNewVersion>,
        args: PublishNewVersionArgs,
    ) -> Result<()> {
        instructions::publish_new_version::handler(ctx, args)
    }
}
