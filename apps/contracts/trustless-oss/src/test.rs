#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, String};

fn setup_test() -> (Env, TrustlessOssContractClient<'static>, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(TrustlessOssContract, ());
    let client = TrustlessOssContractClient::new(&env, &contract_id);
    
    let platform = Address::generate(&env);
    let contributor = Address::generate(&env);
    let maintainer = Address::generate(&env);
    let token_admin = Address::generate(&env);

    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_admin_client = soroban_sdk::token::StellarAssetClient::new(&env, &token_contract);
    
    token_admin_client.mint(&contract_id, &100_000_000);

    env.as_contract(&contract_id, || {
        let escrow = types::EscrowState {
            repo_id: 1,
            maintainer: maintainer.clone(),
            platform: platform.clone(),
            token: token_contract.clone(),
            total_deposited: 100_000_000,
            reserved: 100_000_000,
            total_released: 0,
            created_at: env.ledger().timestamp(),
            is_active: true,
        };
        storage::set_escrow(&env, &escrow);

        let milestone = types::Milestone {
            issue_id: 1,
            title: String::from_str(&env, "Issue 1"),
            reward: 50_000_000, // 5 USDC
            contributor: Some(contributor.clone()),
            status: types::MilestoneStatus::Active,
            created_at: env.ledger().timestamp(),
            released_at: None,
            actual_released: 0,
        };
        storage::set_milestone(&env, 1, &milestone);
    });

    (env, client, platform, contributor, token_contract, contract_id)
}

#[test]
fn test_release_funds() {
    let (env, client, _platform, contributor, token_contract, contract_id) = setup_test();

    client.release_funds(&1);

    let token_client = soroban_sdk::token::Client::new(&env, &token_contract);
    let contributor_balance = token_client.balance(&contributor);
    assert_eq!(contributor_balance, 50_000_000);

    env.as_contract(&contract_id, || {
        let escrow = storage::get_escrow(&env);
        assert_eq!(escrow.reserved, 50_000_000); // 100m - 50m
        assert_eq!(escrow.total_released, 50_000_000);

        let milestone = storage::get_milestone(&env, 1);
        assert_eq!(milestone.status, types::MilestoneStatus::Released);
        assert_eq!(milestone.actual_released, 50_000_000);
        assert!(milestone.released_at.is_some());
    });
}

#[test]
fn test_partial_release() {
    let (env, client, _platform, contributor, token_contract, contract_id) = setup_test();

    client.partial_release(&1, &30_000_000); // Release 3 USDC

    let token_client = soroban_sdk::token::Client::new(&env, &token_contract);
    let contributor_balance = token_client.balance(&contributor);
    assert_eq!(contributor_balance, 30_000_000);

    env.as_contract(&contract_id, || {
        let escrow = storage::get_escrow(&env);
        assert_eq!(escrow.reserved, 50_000_000); // 100m - 50m
        assert_eq!(escrow.total_released, 30_000_000);

        let milestone = storage::get_milestone(&env, 1);
        assert_eq!(milestone.status, types::MilestoneStatus::Released);
        assert_eq!(milestone.actual_released, 30_000_000);
        assert!(milestone.released_at.is_some());
    });
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #34)")]
fn test_over_release_panics() {
    let (_env, client, _platform, _contributor, _token_contract, _contract_id) = setup_test();

    client.partial_release(&1, &60_000_000); // More than 50_000_000
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #32)")]
fn test_release_pending_milestone_panics() {
    let (env, client, _platform, _contributor, _token_contract, contract_id) = setup_test();

    env.as_contract(&contract_id, || {
        let mut milestone = storage::get_milestone(&env, 1);
        milestone.status = types::MilestoneStatus::Pending;
        storage::set_milestone(&env, 1, &milestone);
    });

    client.release_funds(&1);
}

#[test]
#[should_panic(expected = "HostError: Error(Contract, #12)")]
fn test_release_escrow_inactive_panics() {
    let (env, client, _platform, _contributor, _token_contract, contract_id) = setup_test();

    env.as_contract(&contract_id, || {
        let mut escrow = storage::get_escrow(&env);
        escrow.is_active = false;
        storage::set_escrow(&env, &escrow);
    });

    client.release_funds(&1);
}
