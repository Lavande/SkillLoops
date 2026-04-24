use solana_sdk::signature::Keypair;

pub struct Personas {
    pub admin: Keypair,
    pub judge: Keypair,
    pub alice: Keypair,
    pub bob: Keypair,
    pub carol: Keypair,
}

impl Personas {
    pub fn fresh() -> Self {
        Self {
            admin: Keypair::new(),
            judge: Keypair::new(),
            alice: Keypair::new(),
            bob: Keypair::new(),
            carol: Keypair::new(),
        }
    }
}

pub const ALICE_SKILL_NAME: &str = "GitHub PR Review";
pub const ALICE_SKILL_DESCRIPTION: &str = "Reviews PRs for tests, style, security, safety.";
pub const ALICE_SKILL_CATEGORY: &str = "coding";
pub const ALICE_PRICE_LAMPORTS: u64 = 100_000_000; // 0.1 SOL
pub const ALICE_FLOOR_BPS: u16 = 4_000; // 40%
pub const ALICE_K: u16 = 10;
pub const DEMO_PERIOD_SECONDS: i64 = 300;
