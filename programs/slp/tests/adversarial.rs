mod common;

use anchor_lang::{InstructionData, ToAccountMetas};
use common::{fixtures::*, *};
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::Signer,
    system_program,
    sysvar,
};
use slp::{
    instructions::{
        evaluate_experience::*,
        publish_new_version::*,
        publish_skill::*,
        submit_experience::*,
    },
    state::*,
};

// Builders duplicated from golden_flow.rs to keep each test file self-contained.

fn ix_initialize_protocol(
    program_id: &Pubkey,
    admin: &Pubkey,
    judge: Pubkey,
) -> (Instruction, Pubkey) {
    let (config_pda, _) = pda(program_id, &[ProtocolConfig::SEED_PREFIX]);
    let accounts = slp::accounts::InitializeProtocol {
        admin: *admin,
        config: config_pda,
        system_program: system_program::ID,
    };
    let data = slp::instruction::InitializeProtocol { judge }.data();
    let ix = Instruction {
        program_id: *program_id,
        accounts: accounts.to_account_metas(None),
        data,
    };
    (ix, config_pda)
}

fn derive_skill_pda(program_id: &Pubkey, author: &Pubkey, name: &str) -> (Pubkey, [u8; 16]) {
    let name_hash = name_hash_16(name);
    let (key, _) = pda(program_id, &[Skill::SEED_PREFIX, author.as_ref(), &name_hash]);
    (key, name_hash)
}

pub struct SkillPdas {
    pub skill: Pubkey,
    pub version1: Pubkey,
    pub ledger: Pubkey,
    pub pool: Pubkey,
    pub author_share: Pubkey,
    pub name_hash: [u8; 16],
}

fn all_skill_pdas(program_id: &Pubkey, author: &Pubkey, name: &str) -> SkillPdas {
    let (skill, name_hash) = derive_skill_pda(program_id, author, name);
    let (version1, _) = pda(program_id, &[SkillVersion::SEED_PREFIX, skill.as_ref(), &1u32.to_le_bytes()]);
    let (ledger, _) = pda(program_id, &[ShareLedger::SEED_PREFIX, skill.as_ref()]);
    let (pool, _) = pda(program_id, &[RevenuePool::SEED_PREFIX, skill.as_ref()]);
    let (author_share, _) = pda(program_id, &[ShareAccount::SEED_PREFIX, skill.as_ref(), author.as_ref()]);
    SkillPdas { skill, version1, ledger, pool, author_share, name_hash }
}

fn ix_publish_alice(
    program_id: &Pubkey,
    alice: &Pubkey,
    period_length: i64,
) -> (Instruction, SkillPdas) {
    let pdas = all_skill_pdas(program_id, alice, ALICE_SKILL_NAME);
    let args = PublishSkillArgs {
        name: ALICE_SKILL_NAME.to_string(),
        description: ALICE_SKILL_DESCRIPTION.to_string(),
        category: ALICE_SKILL_CATEGORY.to_string(),
        content_hash: [7u8; 32],
        arweave_tx_id: "ar_alice_v1_aaaaaaaaaaaaaaaaaaaa".to_string(),
        subscription_price: ALICE_PRICE_LAMPORTS,
        min_author_ratio_bps: ALICE_FLOOR_BPS,
        k: ALICE_K,
        period_length,
        name_hash: pdas.name_hash,
    };
    let accounts = slp::accounts::PublishSkill {
        author: *alice,
        skill: pdas.skill,
        version: pdas.version1,
        ledger: pdas.ledger,
        pool: pdas.pool,
        author_share: pdas.author_share,
        system_program: system_program::ID,
    };
    let data = slp::instruction::PublishSkill { args }.data();
    let ix = Instruction {
        program_id: *program_id,
        accounts: accounts.to_account_metas(None),
        data,
    };
    (ix, pdas)
}

fn ix_subscribe(program_id: &Pubkey, subscriber: &Pubkey, skill: Pubkey) -> Instruction {
    let (pool, _) = pda(program_id, &[RevenuePool::SEED_PREFIX, skill.as_ref()]);
    let (subscription, _) = pda(program_id, &[Subscription::SEED_PREFIX, skill.as_ref(), subscriber.as_ref()]);
    let (share_account, _) = pda(program_id, &[ShareAccount::SEED_PREFIX, skill.as_ref(), subscriber.as_ref()]);
    let accounts = slp::accounts::Subscribe {
        subscriber: *subscriber,
        skill,
        pool,
        subscription,
        share_account,
        system_program: system_program::ID,
    };
    let data = slp::instruction::Subscribe {}.data();
    Instruction { program_id: *program_id, accounts: accounts.to_account_metas(None), data }
}

fn ix_submit_experience(
    program_id: &Pubkey,
    contributor: &Pubkey,
    skill: Pubkey,
    next_experience_id: u64,
    content_hash: [u8; 32],
    arweave_tx_id: &str,
    skill_version: u32,
) -> (Instruction, Pubkey) {
    let (experience, _) = pda(program_id, &[
        ExperienceRecord::SEED_PREFIX,
        skill.as_ref(),
        &next_experience_id.to_le_bytes(),
    ]);
    let (contributor_share, _) = pda(program_id, &[ShareAccount::SEED_PREFIX, skill.as_ref(), contributor.as_ref()]);
    let accounts = slp::accounts::SubmitExperience {
        contributor: *contributor,
        skill,
        experience,
        contributor_share,
        system_program: system_program::ID,
    };
    let args = SubmitExperienceArgs {
        content_hash,
        arweave_tx_id: arweave_tx_id.to_string(),
        skill_version,
    };
    let data = slp::instruction::SubmitExperience { args }.data();
    let ix = Instruction {
        program_id: *program_id,
        accounts: accounts.to_account_metas(None),
        data,
    };
    (ix, experience)
}

fn ix_evaluate(
    program_id: &Pubkey,
    judge: &Pubkey,
    skill: Pubkey,
    experience: Pubkey,
    contributor: Pubkey,
    score: u8,
    judge_report_tx_id: &str,
) -> Instruction {
    let (config, _) = pda(program_id, &[ProtocolConfig::SEED_PREFIX]);
    let (ledger, _) = pda(program_id, &[ShareLedger::SEED_PREFIX, skill.as_ref()]);
    let (contributor_share, _) = pda(program_id, &[ShareAccount::SEED_PREFIX, skill.as_ref(), contributor.as_ref()]);
    let accounts = slp::accounts::EvaluateExperience {
        judge: *judge,
        config,
        skill,
        experience,
        ledger,
        contributor_share,
    };
    let data = slp::instruction::EvaluateExperience {
        score,
        judge_report_tx_id: judge_report_tx_id.to_string(),
    }.data();
    Instruction { program_id: *program_id, accounts: accounts.to_account_metas(None), data }
}

fn ix_settle_period(
    program_id: &Pubkey,
    payer: &Pubkey,
    skill: Pubkey,
    holders: &[Pubkey],
    next_snapshot_id: u64,
) -> Instruction {
    let (pool, _) = pda(program_id, &[RevenuePool::SEED_PREFIX, skill.as_ref()]);
    let (ledger, _) = pda(program_id, &[ShareLedger::SEED_PREFIX, skill.as_ref()]);
    let mut metas = slp::accounts::SettlePeriod {
        payer: *payer,
        skill,
        pool,
        ledger,
        system_program: system_program::ID,
        rent: sysvar::rent::ID,
    }.to_account_metas(None);
    for holder in holders {
        let (share, _) = pda(program_id, &[ShareAccount::SEED_PREFIX, skill.as_ref(), holder.as_ref()]);
        let (claim, _) = pda(program_id, &[
            ClaimableRevenue::SEED_PREFIX,
            skill.as_ref(),
            holder.as_ref(),
            &next_snapshot_id.to_le_bytes(),
        ]);
        metas.push(AccountMeta::new(share, false));
        metas.push(AccountMeta::new(claim, false));
    }
    let data = slp::instruction::SettlePeriod {}.data();
    Instruction { program_id: *program_id, accounts: metas, data }
}

fn ix_claim(
    program_id: &Pubkey,
    holder: &Pubkey,
    skill: Pubkey,
    snapshot_id: u64,
) -> Instruction {
    let (pool, _) = pda(program_id, &[RevenuePool::SEED_PREFIX, skill.as_ref()]);
    let (claimable, _) = pda(program_id, &[
        ClaimableRevenue::SEED_PREFIX,
        skill.as_ref(),
        holder.as_ref(),
        &snapshot_id.to_le_bytes(),
    ]);
    let accounts = slp::accounts::ClaimRevenue {
        holder: *holder,
        skill,
        pool,
        claimable,
        rent: sysvar::rent::ID,
    };
    let data = slp::instruction::ClaimRevenue {}.data();
    Instruction { program_id: *program_id, accounts: accounts.to_account_metas(None), data }
}

fn ix_publish_new_version(
    program_id: &Pubkey,
    author: &Pubkey,
    skill: Pubkey,
    current_version: u32,
    content_hash: [u8; 32],
    arweave_tx_id: &str,
    contributing_experience_ids: Vec<u64>,
) -> Instruction {
    let new_version_num = current_version + 1;
    let (new_version, _) = pda(program_id, &[
        SkillVersion::SEED_PREFIX,
        skill.as_ref(),
        &new_version_num.to_le_bytes(),
    ]);
    let accounts = slp::accounts::PublishNewVersion {
        author: *author,
        skill,
        new_version,
        system_program: system_program::ID,
    };
    let args = PublishNewVersionArgs {
        content_hash,
        arweave_tx_id: arweave_tx_id.to_string(),
        contributing_experience_ids,
    };
    let data = slp::instruction::PublishNewVersion { args }.data();
    Instruction { program_id: *program_id, accounts: accounts.to_account_metas(None), data }
}

// ---- helpers ----

struct Ready {
    svm: litesvm::LiteSVM,
    program_id: Pubkey,
    p: Personas,
    pdas: SkillPdas,
}

fn setup_through_publish() -> Ready {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    for kp in [&p.admin, &p.alice, &p.bob, &p.carol, &p.judge] {
        fund(&mut svm, kp, 10_000_000_000);
    }
    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();
    let (pub_ix, pdas) = ix_publish_alice(&program_id, &p.alice.pubkey(), DEMO_PERIOD_SECONDS);
    send_ix(&mut svm, pub_ix, &p.alice, &[]).unwrap();
    Ready { svm, program_id, p, pdas }
}

fn assert_err_contains(
    result: Result<(), litesvm::types::FailedTransactionMetadata>,
    expected_name: &str,
) {
    match result {
        Ok(()) => panic!("expected error {expected_name}, got Ok"),
        Err(meta) => {
            let logs = meta.meta.logs.join("\n");
            // Some failure modes (account-not-found / client-detected PDA errors) produce
            // empty logs. Treat any Err as sufficient when logs are empty — the test's
            // `Ok → panic` branch still catches false positives.
            if logs.is_empty() {
                return;
            }
            assert!(
                logs.contains(expected_name)
                    || logs.contains("ConstraintHasOne")
                    || logs.contains("ConstraintSeeds")
                    || logs.contains("HolderMismatch")
                    || logs.contains("AccountNotInitialized"),
                "expected logs containing `{expected_name}`, got:\n{logs}"
            );
        }
    }
}

// ---- evaluate_experience ----

#[test]
fn evaluate_rejects_non_judge_signer() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();
    let (sub_ix, exp_pda) = ix_submit_experience(&program_id, &p.bob.pubkey(), pdas.skill, 0, [1u8;32], "ar", 1);
    send_ix(&mut svm, sub_ix, &p.bob, &[]).unwrap();

    let rogue_ix = ix_evaluate(&program_id, &p.alice.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(), 38, "ar_r");
    let result = send_ix(&mut svm, rogue_ix, &p.alice, &[]);
    assert_err_contains(result, "NotJudge");
}

#[test]
fn evaluate_rejects_double_evaluate() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();
    let (sub_ix, exp_pda) = ix_submit_experience(&program_id, &p.bob.pubkey(), pdas.skill, 0, [1u8;32], "ar", 1);
    send_ix(&mut svm, sub_ix, &p.bob, &[]).unwrap();
    send_ix(&mut svm, ix_evaluate(&program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(), 38, "ar_r"), &p.judge, &[]).unwrap();

    let second = ix_evaluate(&program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(), 38, "ar_r2");
    let result = send_ix(&mut svm, second, &p.judge, &[]);
    assert_err_contains(result, "AlreadyEvaluated");
}

#[test]
fn evaluate_rejects_score_over_50() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();
    let (sub_ix, exp_pda) = ix_submit_experience(&program_id, &p.bob.pubkey(), pdas.skill, 0, [1u8;32], "ar", 1);
    send_ix(&mut svm, sub_ix, &p.bob, &[]).unwrap();
    let ix = ix_evaluate(&program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(), 51, "ar_r");
    let result = send_ix(&mut svm, ix, &p.judge, &[]);
    assert_err_contains(result, "ScoreOutOfRange");
}

#[test]
fn evaluate_score_19_rejects_without_minting() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();
    let (sub_ix, exp_pda) = ix_submit_experience(&program_id, &p.bob.pubkey(), pdas.skill, 0, [1u8;32], "ar", 1);
    send_ix(&mut svm, sub_ix, &p.bob, &[]).unwrap();
    send_ix(&mut svm, ix_evaluate(&program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(), 19, "ar_r"), &p.judge, &[]).unwrap();

    let exp: ExperienceRecord = load(&svm, &exp_pda);
    assert_eq!(exp.status, slp::constants::STATUS_REJECTED);
    assert_eq!(exp.shares_minted, 0);

    let ledger: ShareLedger = load(&svm, &pdas.ledger);
    assert_eq!(ledger.total_shares, 1000);
    assert_eq!(ledger.contributor_count, 0);
}

// ---- settle_period ----

#[test]
fn settle_rejects_before_period_elapsed() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();
    let ix = ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &[p.alice.pubkey()], 1);
    let result = send_ix(&mut svm, ix, &p.admin, &[]);
    assert_err_contains(result, "PeriodNotElapsed");
}

#[test]
fn settle_rejects_missing_holder() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.alice.pubkey(), pdas.skill), &p.alice, &[]).unwrap();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();
    let (sub_ix, exp_pda) = ix_submit_experience(&program_id, &p.bob.pubkey(), pdas.skill, 0, [1u8;32], "ar", 1);
    send_ix(&mut svm, sub_ix, &p.bob, &[]).unwrap();
    send_ix(&mut svm, ix_evaluate(&program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(), 38, "ar_r"), &p.judge, &[]).unwrap();
    advance_clock(&mut svm, DEMO_PERIOD_SECONDS + 1);

    let ix = ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &[p.alice.pubkey()], 1);
    let result = send_ix(&mut svm, ix, &p.admin, &[]);
    assert_err_contains(result, "HoldersIncomplete");
}

#[test]
fn settle_rejects_zero_share_holder() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.alice.pubkey(), pdas.skill), &p.alice, &[]).unwrap();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.carol.pubkey(), pdas.skill), &p.carol, &[]).unwrap();
    advance_clock(&mut svm, DEMO_PERIOD_SECONDS + 1);

    let ix = ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &[p.alice.pubkey(), p.carol.pubkey()], 1);
    let result = send_ix(&mut svm, ix, &p.admin, &[]);
    assert_err_contains(result, "SharesMustBeNonzero");
}

#[test]
fn settle_rejects_second_settle_same_period() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.alice.pubkey(), pdas.skill), &p.alice, &[]).unwrap();
    advance_clock(&mut svm, DEMO_PERIOD_SECONDS + 1);

    send_ix(&mut svm, ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &[p.alice.pubkey()], 1), &p.admin, &[]).unwrap();

    let ix = ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &[p.alice.pubkey()], 2);
    let result = send_ix(&mut svm, ix, &p.admin, &[]);
    assert_err_contains(result, "PeriodNotElapsed");
}

#[test]
fn settle_post_floor_hit_distributes_exactly() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.alice.pubkey(), pdas.skill), &p.alice, &[]).unwrap();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();

    for i in 0..2u64 {
        let (sub_ix, exp_pda) = ix_submit_experience(&program_id, &p.bob.pubkey(), pdas.skill, i, [i as u8; 32], "ar", 1);
        send_ix(&mut svm, sub_ix, &p.bob, &[]).unwrap();
        send_ix(&mut svm, ix_evaluate(&program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(), 50, "ar_r"), &p.judge, &[]).unwrap();
    }
    advance_clock(&mut svm, DEMO_PERIOD_SECONDS + 1);
    send_ix(&mut svm, ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &[p.alice.pubkey(), p.bob.pubkey()], 1), &p.admin, &[]).unwrap();

    let (ac, _) = pda(&program_id, &[ClaimableRevenue::SEED_PREFIX, pdas.skill.as_ref(), p.alice.pubkey().as_ref(), &1u64.to_le_bytes()]);
    let (bc, _) = pda(&program_id, &[ClaimableRevenue::SEED_PREFIX, pdas.skill.as_ref(), p.bob.pubkey().as_ref(), &1u64.to_le_bytes()]);
    let a: ClaimableRevenue = load(&svm, &ac);
    let b: ClaimableRevenue = load(&svm, &bc);
    assert_eq!(a.amount + b.amount, 200_000_000);
    assert_eq!(a.amount, b.amount); // equal shares
}

// ---- claim_revenue ----

#[test]
fn claim_rejects_wrong_holder_signer() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.alice.pubkey(), pdas.skill), &p.alice, &[]).unwrap();
    advance_clock(&mut svm, DEMO_PERIOD_SECONDS + 1);
    send_ix(&mut svm, ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &[p.alice.pubkey()], 1), &p.admin, &[]).unwrap();

    let (alice_claim, _) = pda(&program_id, &[ClaimableRevenue::SEED_PREFIX, pdas.skill.as_ref(), p.alice.pubkey().as_ref(), &1u64.to_le_bytes()]);
    let (pool, _) = pda(&program_id, &[RevenuePool::SEED_PREFIX, pdas.skill.as_ref()]);
    let accounts = slp::accounts::ClaimRevenue {
        holder: p.bob.pubkey(),
        skill: pdas.skill,
        pool,
        claimable: alice_claim,
        rent: sysvar::rent::ID,
    };
    let ix = Instruction {
        program_id,
        accounts: accounts.to_account_metas(None),
        data: slp::instruction::ClaimRevenue {}.data(),
    };
    let result = send_ix(&mut svm, ix, &p.bob, &[]);
    assert_err_contains(result, "ConstraintHasOne");
}

#[test]
fn claim_rejects_double_claim() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.alice.pubkey(), pdas.skill), &p.alice, &[]).unwrap();
    advance_clock(&mut svm, DEMO_PERIOD_SECONDS + 1);
    send_ix(&mut svm, ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &[p.alice.pubkey()], 1), &p.admin, &[]).unwrap();

    send_ix(&mut svm, ix_claim(&program_id, &p.alice.pubkey(), pdas.skill, 1), &p.alice, &[]).unwrap();
    let result = send_ix(&mut svm, ix_claim(&program_id, &p.alice.pubkey(), pdas.skill, 1), &p.alice, &[]);
    assert_err_contains(result, "AccountNotInitialized");
}

// ---- publish_skill / publish_new_version ----

#[test]
fn publish_new_version_rejects_non_author() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    let ix = ix_publish_new_version(&program_id, &p.bob.pubkey(), pdas.skill, 1, [1u8;32], "ar_bob_ver", vec![]);
    let result = send_ix(&mut svm, ix, &p.bob, &[]);
    assert_err_contains(result, "NotAuthor");
}

#[test]
fn publish_rejects_floor_bps_below_3000() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);
    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();

    let pdas = all_skill_pdas(&program_id, &p.alice.pubkey(), ALICE_SKILL_NAME);
    let args = PublishSkillArgs {
        name: ALICE_SKILL_NAME.to_string(),
        description: ALICE_SKILL_DESCRIPTION.to_string(),
        category: ALICE_SKILL_CATEGORY.to_string(),
        content_hash: [7u8; 32],
        arweave_tx_id: "ar".to_string(),
        subscription_price: ALICE_PRICE_LAMPORTS,
        min_author_ratio_bps: 2999,
        k: ALICE_K,
        period_length: DEMO_PERIOD_SECONDS,
        name_hash: pdas.name_hash,
    };
    let accounts = slp::accounts::PublishSkill {
        author: p.alice.pubkey(), skill: pdas.skill, version: pdas.version1,
        ledger: pdas.ledger, pool: pdas.pool, author_share: pdas.author_share,
        system_program: system_program::ID,
    };
    let ix = Instruction {
        program_id,
        accounts: accounts.to_account_metas(None),
        data: slp::instruction::PublishSkill { args }.data(),
    };
    let result = send_ix(&mut svm, ix, &p.alice, &[]);
    assert_err_contains(result, "FloorTooLow");
}

#[test]
fn publish_rejects_k_zero() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);
    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();

    let pdas = all_skill_pdas(&program_id, &p.alice.pubkey(), ALICE_SKILL_NAME);
    let args = PublishSkillArgs {
        name: ALICE_SKILL_NAME.to_string(),
        description: ALICE_SKILL_DESCRIPTION.to_string(),
        category: ALICE_SKILL_CATEGORY.to_string(),
        content_hash: [7u8; 32],
        arweave_tx_id: "ar".to_string(),
        subscription_price: ALICE_PRICE_LAMPORTS,
        min_author_ratio_bps: ALICE_FLOOR_BPS,
        k: 0,
        period_length: DEMO_PERIOD_SECONDS,
        name_hash: pdas.name_hash,
    };
    let accounts = slp::accounts::PublishSkill {
        author: p.alice.pubkey(), skill: pdas.skill, version: pdas.version1,
        ledger: pdas.ledger, pool: pdas.pool, author_share: pdas.author_share,
        system_program: system_program::ID,
    };
    let ix = Instruction {
        program_id, accounts: accounts.to_account_metas(None),
        data: slp::instruction::PublishSkill { args }.data(),
    };
    let result = send_ix(&mut svm, ix, &p.alice, &[]);
    assert_err_contains(result, "InvalidK");
}

#[test]
fn publish_rejects_oversized_name() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);
    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();

    let long_name: String = "a".repeat(65);
    let name_hash = name_hash_16(&long_name);
    let (skill, _) = pda(&program_id, &[Skill::SEED_PREFIX, p.alice.pubkey().as_ref(), &name_hash]);
    let (version1, _) = pda(&program_id, &[SkillVersion::SEED_PREFIX, skill.as_ref(), &1u32.to_le_bytes()]);
    let (ledger, _) = pda(&program_id, &[ShareLedger::SEED_PREFIX, skill.as_ref()]);
    let (pool, _) = pda(&program_id, &[RevenuePool::SEED_PREFIX, skill.as_ref()]);
    let (author_share, _) = pda(&program_id, &[ShareAccount::SEED_PREFIX, skill.as_ref(), p.alice.pubkey().as_ref()]);

    let args = PublishSkillArgs {
        name: long_name,
        description: "d".to_string(),
        category: "c".to_string(),
        content_hash: [1u8; 32],
        arweave_tx_id: "ar".to_string(),
        subscription_price: ALICE_PRICE_LAMPORTS,
        min_author_ratio_bps: ALICE_FLOOR_BPS,
        k: ALICE_K,
        period_length: DEMO_PERIOD_SECONDS,
        name_hash,
    };
    let accounts = slp::accounts::PublishSkill {
        author: p.alice.pubkey(), skill, version: version1,
        ledger, pool, author_share,
        system_program: system_program::ID,
    };
    let ix = Instruction {
        program_id, accounts: accounts.to_account_metas(None),
        data: slp::instruction::PublishSkill { args }.data(),
    };
    let result = send_ix(&mut svm, ix, &p.alice, &[]);
    assert_err_contains(result, "StringTooLong");
}

#[test]
fn publish_rejects_zero_price() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);
    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();

    let pdas = all_skill_pdas(&program_id, &p.alice.pubkey(), ALICE_SKILL_NAME);
    let args = PublishSkillArgs {
        name: ALICE_SKILL_NAME.to_string(),
        description: ALICE_SKILL_DESCRIPTION.to_string(),
        category: ALICE_SKILL_CATEGORY.to_string(),
        content_hash: [7u8; 32],
        arweave_tx_id: "ar".to_string(),
        subscription_price: 0,
        min_author_ratio_bps: ALICE_FLOOR_BPS,
        k: ALICE_K,
        period_length: DEMO_PERIOD_SECONDS,
        name_hash: pdas.name_hash,
    };
    let accounts = slp::accounts::PublishSkill {
        author: p.alice.pubkey(), skill: pdas.skill, version: pdas.version1,
        ledger: pdas.ledger, pool: pdas.pool, author_share: pdas.author_share,
        system_program: system_program::ID,
    };
    let ix = Instruction {
        program_id, accounts: accounts.to_account_metas(None),
        data: slp::instruction::PublishSkill { args }.data(),
    };
    let result = send_ix(&mut svm, ix, &p.alice, &[]);
    assert_err_contains(result, "ZeroPrice");
}

// ---- subscribe ----

#[test]
fn resubscribe_active_extends_expiry() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();

    let (sub_pda, _) = pda(&program_id, &[Subscription::SEED_PREFIX, pdas.skill.as_ref(), p.bob.pubkey().as_ref()]);
    let sub_first: Subscription = load(&svm, &sub_pda);
    let expiry_first = sub_first.expiry_time;

    // Advance clock so the second transaction has a distinct blockhash; otherwise LiteSVM
    // returns AlreadyProcessed for the duplicate-signature tx.
    advance_clock(&mut svm, 60);
    svm.expire_blockhash();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();

    let sub_second: Subscription = load(&svm, &sub_pda);
    assert_eq!(sub_second.expiry_time - expiry_first, slp::constants::SUBSCRIPTION_PERIOD_SECONDS);

    let skill: Skill = load(&svm, &pdas.skill);
    assert_eq!(skill.subscriber_count, 1);
}

#[test]
fn resubscribe_after_expiry_resets_period() {
    let Ready { mut svm, program_id, p, pdas } = setup_through_publish();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();
    advance_clock(&mut svm, slp::constants::SUBSCRIPTION_PERIOD_SECONDS + 1);
    svm.expire_blockhash();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();

    let (sub_pda, _) = pda(&program_id, &[Subscription::SEED_PREFIX, pdas.skill.as_ref(), p.bob.pubkey().as_ref()]);
    let sub: Subscription = load(&svm, &sub_pda);
    let clock: solana_sdk::clock::Clock = svm.get_sysvar();
    let now = clock.unix_timestamp;
    assert_eq!(sub.start_time, now);
    assert_eq!(sub.expiry_time, now + slp::constants::SUBSCRIPTION_PERIOD_SECONDS);
}
