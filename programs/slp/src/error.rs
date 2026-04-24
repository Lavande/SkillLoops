use anchor_lang::prelude::*;

#[error_code]
pub enum SlpError {
    #[msg("Caller is not the protocol Judge")]
    NotJudge,

    #[msg("Experience already evaluated")]
    AlreadyEvaluated,

    #[msg("Score must be 0..=50")]
    ScoreOutOfRange,

    #[msg("Experience does not belong to this skill")]
    WrongSkill,

    #[msg("Settlement period has not elapsed")]
    PeriodNotElapsed,

    #[msg("Settlement is missing holders")]
    HoldersIncomplete,

    #[msg("ShareAccount belongs to wrong skill")]
    ShareAccountMismatch,

    #[msg("Zero-share holders may not be settled")]
    SharesMustBeNonzero,

    #[msg("ClaimableRevenue PDA is incorrect")]
    WrongClaimPda,

    #[msg("Nothing to claim")]
    NothingToClaim,

    #[msg("Subscription price cannot be zero")]
    ZeroPrice,

    #[msg("Author ratio floor below protocol minimum")]
    FloorTooLow,

    #[msg("Contribution coefficient out of range")]
    InvalidK,

    #[msg("String field exceeds maximum length")]
    StringTooLong,

    #[msg("Only the skill author can publish new versions")]
    NotAuthor,

    #[msg("Too many contributing experiences for one version")]
    TooManyContributors,

    #[msg("Claim would leave pool below rent-exempt")]
    PoolBelowRentExempt,

    #[msg("Settle remaining_accounts must be paired (ShareAccount, ClaimableRevenue)")]
    SettleAccountsUnpaired,
}
