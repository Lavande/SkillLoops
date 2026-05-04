pub const MIN_APPROVE_SCORE: u8 = 20;
pub const MAX_SCORE: u8 = 50;

pub const K_DEFAULT: u16 = 100;
pub const K_MIN: u16 = 1;
pub const K_MAX: u16 = 100;

pub const INITIAL_TOTAL_SHARES: u64 = 1_000;
pub const MIN_AUTHOR_RATIO_BPS_FLOOR: u16 = 3_000;
pub const OWNERSHIP_BPS: u16 = 10_000;
pub const POINTS_PER_100BPS_DEFAULT: u64 = 250;
pub const MAX_POOL_INCREASE_PER_EVALUATION_BPS_DEFAULT: u16 = 500;

pub const LOCK_PERIOD_SECONDS: i64 = 180 * 24 * 60 * 60;
pub const SUBSCRIPTION_PERIOD_SECONDS: i64 = 30 * 24 * 60 * 60;
pub const SETTLE_PERIOD_SECONDS_DEFAULT: i64 = 300;

pub const MAX_NAME_LEN: usize = 64;
pub const MAX_DESCRIPTION_LEN: usize = 256;
pub const MAX_CATEGORY_LEN: usize = 32;
pub const MAX_ARWEAVE_TX_ID_LEN: usize = 64;
pub const MAX_CONTRIBUTORS_PER_VERSION: usize = 16;

pub const STATUS_PENDING: u8 = 0;
pub const STATUS_EVALUATED: u8 = 1;
pub const STATUS_REJECTED: u8 = 2;
