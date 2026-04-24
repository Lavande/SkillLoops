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

// ---- Instruction builders ----

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
    Instruction {
        program_id: *program_id,
        accounts: accounts.to_account_metas(None),
        data,
    }
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
    Instruction {
        program_id: *program_id,
        accounts: accounts.to_account_metas(None),
        data,
    }
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
    Instruction {
        program_id: *program_id,
        accounts: metas,
        data,
    }
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
    Instruction {
        program_id: *program_id,
        accounts: accounts.to_account_metas(None),
        data,
    }
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
    Instruction {
        program_id: *program_id,
        accounts: accounts.to_account_metas(None),
        data,
    }
}

// ---------- Tests ----------

#[test]
fn publish_skill_initializes_cap_table() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);

    let (ix, _) = ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey());
    send_ix(&mut svm, ix, &p.admin, &[]).expect("init protocol");

    let (ix, pdas) = ix_publish_alice(&program_id, &p.alice.pubkey(), DEMO_PERIOD_SECONDS);
    send_ix(&mut svm, ix, &p.alice, &[]).expect("publish skill");

    let skill: Skill = load(&svm, &pdas.skill);
    assert_eq!(skill.current_version, 1);
    assert_eq!(skill.subscriber_count, 0);
    assert_eq!(skill.next_experience_id, 0);
    assert_eq!(skill.author, p.alice.pubkey());

    let ledger: ShareLedger = load(&svm, &pdas.ledger);
    assert_eq!(ledger.total_shares, 1000);
    assert_eq!(ledger.author_shares, 1000);
    assert_eq!(ledger.contributor_count, 0);

    let author_share: ShareAccount = load(&svm, &pdas.author_share);
    assert_eq!(author_share.shares, 1000);
    assert_eq!(author_share.holder, p.alice.pubkey());

    let v1: SkillVersion = load(&svm, &pdas.version1);
    assert_eq!(v1.version, 1);
    assert!(v1.contributing_experience_ids.is_empty());
}

#[test]
fn subscribe_creates_share_account_at_zero() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);
    fund(&mut svm, &p.bob, 10_000_000_000);

    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();
    let (pub_ix, pdas) = ix_publish_alice(&program_id, &p.alice.pubkey(), DEMO_PERIOD_SECONDS);
    send_ix(&mut svm, pub_ix, &p.alice, &[]).unwrap();

    let pool_lamports_before = svm.get_account(&pdas.pool).unwrap().lamports;

    let sub_ix = ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill);
    send_ix(&mut svm, sub_ix, &p.bob, &[]).expect("subscribe");

    let (bob_share_pda, _) = pda(&program_id, &[ShareAccount::SEED_PREFIX, pdas.skill.as_ref(), p.bob.pubkey().as_ref()]);
    let (bob_sub_pda, _) = pda(&program_id, &[Subscription::SEED_PREFIX, pdas.skill.as_ref(), p.bob.pubkey().as_ref()]);

    let bob_share: ShareAccount = load(&svm, &bob_share_pda);
    assert_eq!(bob_share.shares, 0);

    let bob_sub: Subscription = load(&svm, &bob_sub_pda);
    assert!(bob_sub.is_active);

    let pool_lamports_after = svm.get_account(&pdas.pool).unwrap().lamports;
    assert_eq!(pool_lamports_after - pool_lamports_before, ALICE_PRICE_LAMPORTS);

    let skill: Skill = load(&svm, &pdas.skill);
    assert_eq!(skill.subscriber_count, 1);
    assert_eq!(skill.total_revenue, ALICE_PRICE_LAMPORTS);

    let pool: RevenuePool = load(&svm, &pdas.pool);
    assert_eq!(pool.current_period_revenue, ALICE_PRICE_LAMPORTS);
}

#[test]
fn submit_and_evaluate_mints_shares() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);
    fund(&mut svm, &p.bob, 10_000_000_000);
    fund(&mut svm, &p.judge, 10_000_000_000);

    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();
    let (pub_ix, pdas) = ix_publish_alice(&program_id, &p.alice.pubkey(), DEMO_PERIOD_SECONDS);
    send_ix(&mut svm, pub_ix, &p.alice, &[]).unwrap();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();

    let (submit_ix, exp_pda) = ix_submit_experience(
        &program_id, &p.bob.pubkey(), pdas.skill,
        0, [42u8; 32], "ar_bob_rust_unsafe_demo_2026_04_23", 1,
    );
    send_ix(&mut svm, submit_ix, &p.bob, &[]).unwrap();

    let exp: ExperienceRecord = load(&svm, &exp_pda);
    assert_eq!(exp.status, slp::constants::STATUS_PENDING);

    let eval_ix = ix_evaluate(
        &program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(),
        38, "ar_judge_report_2026_04_23",
    );
    send_ix(&mut svm, eval_ix, &p.judge, &[]).unwrap();

    let exp: ExperienceRecord = load(&svm, &exp_pda);
    assert_eq!(exp.status, slp::constants::STATUS_EVALUATED);
    assert_eq!(exp.shares_minted, 380);

    let ledger: ShareLedger = load(&svm, &pdas.ledger);
    assert_eq!(ledger.total_shares, 1380);
    assert_eq!(ledger.contributor_count, 1);

    let (bob_share_pda, _) = pda(&program_id, &[ShareAccount::SEED_PREFIX, pdas.skill.as_ref(), p.bob.pubkey().as_ref()]);
    let bob_share: ShareAccount = load(&svm, &bob_share_pda);
    assert_eq!(bob_share.shares, 380);
    assert!(bob_share.lock_until > 0);
}

#[test]
fn settle_distributes_proportionally() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);
    fund(&mut svm, &p.bob, 10_000_000_000);
    fund(&mut svm, &p.carol, 10_000_000_000);
    fund(&mut svm, &p.judge, 10_000_000_000);

    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();
    let (pub_ix, pdas) = ix_publish_alice(&program_id, &p.alice.pubkey(), DEMO_PERIOD_SECONDS);
    send_ix(&mut svm, pub_ix, &p.alice, &[]).unwrap();

    send_ix(&mut svm, ix_subscribe(&program_id, &p.alice.pubkey(), pdas.skill), &p.alice, &[]).unwrap();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();

    let (submit_ix, exp_pda) = ix_submit_experience(
        &program_id, &p.bob.pubkey(), pdas.skill,
        0, [42u8; 32], "ar_bob_demo", 1,
    );
    send_ix(&mut svm, submit_ix, &p.bob, &[]).unwrap();
    send_ix(&mut svm, ix_evaluate(
        &program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(),
        38, "ar_judge_report",
    ), &p.judge, &[]).unwrap();

    send_ix(&mut svm, ix_subscribe(&program_id, &p.carol.pubkey(), pdas.skill), &p.carol, &[]).unwrap();

    advance_clock(&mut svm, DEMO_PERIOD_SECONDS + 1);

    let next_snapshot_id = 1u64;
    let holders = [p.alice.pubkey(), p.bob.pubkey()];
    send_ix(
        &mut svm,
        ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &holders, next_snapshot_id),
        &p.admin,
        &[],
    ).unwrap();

    let (alice_claim, _) = pda(&program_id, &[
        ClaimableRevenue::SEED_PREFIX,
        pdas.skill.as_ref(),
        p.alice.pubkey().as_ref(),
        &next_snapshot_id.to_le_bytes(),
    ]);
    let (bob_claim, _) = pda(&program_id, &[
        ClaimableRevenue::SEED_PREFIX,
        pdas.skill.as_ref(),
        p.bob.pubkey().as_ref(),
        &next_snapshot_id.to_le_bytes(),
    ]);

    // Pool: Alice + Bob + Carol subscriptions = 3 × 100_000_000 = 300_000_000 lamports.
    // Floor-divide split with remainder to largest-share holder.
    // Alice 1000/1380: 300M * 1000 / 1380 = 217_391_304 + remainder 1 → 217_391_305.
    // Bob   380/1380:  300M * 380  / 1380 = 82_608_695.
    let ac: ClaimableRevenue = load(&svm, &alice_claim);
    let bc: ClaimableRevenue = load(&svm, &bob_claim);
    assert_eq!(ac.amount, 217_391_305);
    assert_eq!(bc.amount, 82_608_695);
    assert_eq!(ac.amount + bc.amount, 300_000_000);

    let pool: RevenuePool = load(&svm, &pdas.pool);
    assert_eq!(pool.current_period_revenue, 0);
    assert_eq!(pool.snapshot_id, 1);
}

#[test]
fn claim_transfers_lamports() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);
    fund(&mut svm, &p.bob, 10_000_000_000);
    fund(&mut svm, &p.carol, 10_000_000_000);
    fund(&mut svm, &p.judge, 10_000_000_000);

    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();
    let (pub_ix, pdas) = ix_publish_alice(&program_id, &p.alice.pubkey(), DEMO_PERIOD_SECONDS);
    send_ix(&mut svm, pub_ix, &p.alice, &[]).unwrap();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.alice.pubkey(), pdas.skill), &p.alice, &[]).unwrap();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();
    let (submit_ix, exp_pda) = ix_submit_experience(
        &program_id, &p.bob.pubkey(), pdas.skill, 0, [42u8; 32], "ar_bob", 1,
    );
    send_ix(&mut svm, submit_ix, &p.bob, &[]).unwrap();
    send_ix(&mut svm, ix_evaluate(&program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(), 38, "ar_rep"), &p.judge, &[]).unwrap();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.carol.pubkey(), pdas.skill), &p.carol, &[]).unwrap();
    advance_clock(&mut svm, DEMO_PERIOD_SECONDS + 1);
    send_ix(
        &mut svm,
        ix_settle_period(&program_id, &p.admin.pubkey(), pdas.skill, &[p.alice.pubkey(), p.bob.pubkey()], 1),
        &p.admin, &[],
    ).unwrap();

    let alice_before = svm.get_account(&p.alice.pubkey()).unwrap().lamports;
    let bob_before = svm.get_account(&p.bob.pubkey()).unwrap().lamports;

    send_ix(&mut svm, ix_claim(&program_id, &p.alice.pubkey(), pdas.skill, 1), &p.alice, &[]).unwrap();
    send_ix(&mut svm, ix_claim(&program_id, &p.bob.pubkey(), pdas.skill, 1), &p.bob, &[]).unwrap();

    let alice_after = svm.get_account(&p.alice.pubkey()).unwrap().lamports;
    let bob_after = svm.get_account(&p.bob.pubkey()).unwrap().lamports;

    // Same 300M pool setup: Alice ≈ 217M, Bob ≈ 82M (see settle_distributes_proportionally).
    assert!(alice_after > alice_before + 217_000_000, "Alice got {}", alice_after - alice_before);
    assert!(bob_after > bob_before + 82_000_000, "Bob got {}", bob_after - bob_before);

    let (alice_claim, _) = pda(&program_id, &[
        ClaimableRevenue::SEED_PREFIX, pdas.skill.as_ref(), p.alice.pubkey().as_ref(), &1u64.to_le_bytes(),
    ]);
    assert!(svm.get_account(&alice_claim).is_none() || svm.get_account(&alice_claim).unwrap().lamports == 0);
}

#[test]
fn publish_new_version_records_contributor() {
    let (mut svm, program_id) = new_svm_with_program();
    let p = Personas::fresh();
    fund(&mut svm, &p.admin, 10_000_000_000);
    fund(&mut svm, &p.alice, 10_000_000_000);
    fund(&mut svm, &p.bob, 10_000_000_000);
    fund(&mut svm, &p.judge, 10_000_000_000);

    send_ix(&mut svm, ix_initialize_protocol(&program_id, &p.admin.pubkey(), p.judge.pubkey()).0, &p.admin, &[]).unwrap();
    let (pub_ix, pdas) = ix_publish_alice(&program_id, &p.alice.pubkey(), DEMO_PERIOD_SECONDS);
    send_ix(&mut svm, pub_ix, &p.alice, &[]).unwrap();
    send_ix(&mut svm, ix_subscribe(&program_id, &p.bob.pubkey(), pdas.skill), &p.bob, &[]).unwrap();
    let (submit_ix, exp_pda) = ix_submit_experience(
        &program_id, &p.bob.pubkey(), pdas.skill, 0, [42u8; 32], "ar_bob", 1,
    );
    send_ix(&mut svm, submit_ix, &p.bob, &[]).unwrap();
    send_ix(&mut svm, ix_evaluate(&program_id, &p.judge.pubkey(), pdas.skill, exp_pda, p.bob.pubkey(), 38, "ar_rep"), &p.judge, &[]).unwrap();

    let bob_exp_id = 0u64;
    send_ix(&mut svm, ix_publish_new_version(
        &program_id, &p.alice.pubkey(), pdas.skill, 1,
        [99u8; 32], "ar_alice_v2_aaaaaaaaaaaaaaaaaaaa",
        vec![bob_exp_id],
    ), &p.alice, &[]).unwrap();

    let skill: Skill = load(&svm, &pdas.skill);
    assert_eq!(skill.current_version, 2);
    assert_eq!(skill.content_hash, [99u8; 32]);

    let (v2_pda, _) = pda(&program_id, &[SkillVersion::SEED_PREFIX, pdas.skill.as_ref(), &2u32.to_le_bytes()]);
    let v2: SkillVersion = load(&svm, &v2_pda);
    assert_eq!(v2.version, 2);
    assert_eq!(v2.contributing_experience_ids, vec![bob_exp_id]);
}
