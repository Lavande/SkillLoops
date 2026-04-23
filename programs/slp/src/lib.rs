use anchor_lang::prelude::*;

declare_id!("BnuTXrifL3hja2YeyMBpUVgRoJ5N6zrpH1hPmaDit1FJ");

pub mod constants;
pub mod error;
pub mod events;
pub mod math;
pub mod state;
// Re-enabled in Task 9+ once instructions module exists:
// pub mod instructions;
// use instructions::*;

#[program]
pub mod slp {
    use super::*;
}
