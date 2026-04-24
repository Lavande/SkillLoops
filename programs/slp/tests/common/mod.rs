#![allow(dead_code)]

use anchor_lang::AccountDeserialize;
use litesvm::LiteSVM;
use solana_sdk::{
    instruction::Instruction,
    message::Message,
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

pub use slp::{self as slp_program, state::*};

pub mod fixtures;

/// Absolute path to the freshly-built program `.so`.
pub fn program_so_path() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    p.pop(); // programs/slp -> programs
    p.push("target/deploy/slp.so");
    p
}

pub fn new_svm_with_program() -> (LiteSVM, Pubkey) {
    let program_id = slp_program::ID;
    let mut svm = LiteSVM::new();
    let so = std::fs::read(program_so_path())
        .expect("build programs first with `cargo build-sbf`");
    svm.add_program(program_id, &so);
    (svm, program_id)
}

pub fn fund(svm: &mut LiteSVM, kp: &Keypair, lamports: u64) {
    svm.airdrop(&kp.pubkey(), lamports).unwrap();
}

pub fn name_hash_16(name: &str) -> [u8; 16] {
    let h = Sha256::digest(name.as_bytes());
    let mut out = [0u8; 16];
    out.copy_from_slice(&h[..16]);
    out
}

pub fn pda(program_id: &Pubkey, seeds: &[&[u8]]) -> (Pubkey, u8) {
    Pubkey::find_program_address(seeds, program_id)
}

/// Send a single-instruction transaction signed by `payer` + any additional signers.
pub fn send_ix(
    svm: &mut LiteSVM,
    ix: Instruction,
    payer: &Keypair,
    extra_signers: &[&Keypair],
) -> Result<(), litesvm::types::FailedTransactionMetadata> {
    let blockhash = svm.latest_blockhash();
    let mut signers: Vec<&Keypair> = vec![payer];
    signers.extend(extra_signers.iter().copied());
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = Transaction::new(&signers, msg, blockhash);
    svm.send_transaction(tx).map(|_| ())
}

/// Load and Anchor-deserialize an account.
pub fn load<T: AccountDeserialize>(svm: &LiteSVM, key: &Pubkey) -> T {
    let acct = svm.get_account(key).expect("account exists");
    T::try_deserialize(&mut &acct.data[..]).expect("deserialize")
}

/// Advance the cluster clock by `seconds` by mutating the Clock sysvar.
pub fn advance_clock(svm: &mut LiteSVM, seconds: i64) {
    let mut clock: solana_sdk::clock::Clock = svm.get_sysvar();
    clock.unix_timestamp += seconds;
    clock.slot += (seconds as u64) * 2;
    svm.set_sysvar(&clock);
}
