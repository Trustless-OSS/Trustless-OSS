#![cfg(test)]

use soroban_sdk::testutils::storage::Persistent as _;
use soroban_sdk::testutils::Events as _;

use super::*;
use crate::types::MilestoneStatus;
use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
use soroban_sdk::{Address, Env, String, Vec};

fn setup_env() -> (Env, soroban_sdk::Address) {
    let env = Env::default();
    env.ledger().set(LedgerInfo {
        timestamp: 12345,
        protocol_version: 23,
        sequence_number: 1,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 10000,
        min_persistent_entry_ttl: 10000,
        max_entry_ttl: 200000,
    });
    let contract_id = env.register_contract(None, TrustlessOssContract);
    (env, contract_id)
}

fn client(env: &Env, contract_id: &soroban_sdk::Address) -> TrustlessOssContractClient<'static> {
    TrustlessOssContractClient::new(env, contract_id)
}

fn addresses(env: &Env) -> (Address, Address, Address) {
    let maintainer = Address::generate(env);
    let platform = Address::generate(env);
    let token = Address::generate(env);
    (maintainer, platform, token)
}

fn initialize_with_funding(
    env: &Env,
    contract_id: &soroban_sdk::Address,
    total_deposited: i128,
) -> (
    TrustlessOssContractClient<'static>,
    Address,
    Address,
    Address,
) {
    let c = client(env, contract_id);
    env.mock_all_auths();
    let (maintainer, platform, token) = addresses(env);

    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    env.as_contract(contract_id, || {
        let mut escrow = storage::get_escrow(env).unwrap();
        escrow.total_deposited = total_deposited;
        storage::set_escrow(env, &escrow);
    });

    (c, maintainer, platform, token)
}

fn assert_contract_err<T>(
    result: Result<
        Result<T, soroban_sdk::ConversionError>,
        Result<ContractError, soroban_sdk::InvokeError>,
    >,
    expected: ContractError,
) {
    match result {
        Err(Ok(actual)) => assert_eq!(actual, expected),
        Err(Err(_)) => panic!("expected contract error {expected:?}, got host invocation error"),
        Ok(_) => panic!("expected contract error {expected:?}, got success"),
    }
}

// ---------------------------------------------------------------------------
// initialize – success path
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_success() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    let escrow = c.get_escrow();
    assert_eq!(escrow.repo_id, 1);
    assert_eq!(escrow.maintainer, maintainer);
    assert_eq!(escrow.platform, platform);
    assert_eq!(escrow.token, token);
    assert_eq!(escrow.total_deposited, 0);
    assert_eq!(escrow.reserved, 0);
    assert_eq!(escrow.total_released, 0);
    assert_eq!(escrow.created_at, 12345);
    assert!(escrow.is_active);
}

#[test]
fn test_initialize_sets_admin() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    env.as_contract(&contract_id, || {
        let stored_admin = storage::get_admin(&env);
        assert_eq!(stored_admin, Some(maintainer));
    });
}

#[test]
fn test_initialize_balance_after_init() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    let balance = c.get_balance();
    assert_eq!(balance.total_deposited, 0);
    assert_eq!(balance.reserved, 0);
    assert_eq!(balance.available, 0);
    assert_eq!(balance.total_released, 0);
}

#[test]
fn test_initialize_emits_event() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    let events = env.events().all();
    assert_eq!(events.len(), 1);
}

// ---------------------------------------------------------------------------
// initialize – error paths
// ---------------------------------------------------------------------------

#[test]
fn test_initialize_rejects_double_init() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    let result = c.try_initialize(&2, &maintainer, &platform, &token);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// storage – EscrowState
// ---------------------------------------------------------------------------

#[test]
fn test_storage_escrow_roundtrip() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    let escrow = c.get_escrow();
    assert_eq!(escrow.repo_id, 1);
    assert_eq!(escrow.maintainer, maintainer);
    assert_eq!(escrow.platform, platform);
}

#[test]
fn test_get_escrow_before_init_panics() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);

    let result = c.try_get_escrow();
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// storage – Milestone
// ---------------------------------------------------------------------------

#[test]
fn test_storage_milestone_roundtrip() {
    let (env, contract_id) = setup_env();

    let milestone = Milestone {
        issue_id: 100,
        title: String::from_str(&env, "Fix critical bug"),
        reward: 50_000_000,
        contributor: None,
        status: MilestoneStatus::Pending,
        created_at: 1000,
        released_at: None,
        actual_released: 0,
    };

    env.as_contract(&contract_id, || {
        storage::set_milestone(&env, 100, &milestone);
    });

    env.as_contract(&contract_id, || {
        let loaded = storage::get_milestone(&env, 100).unwrap();
        assert_eq!(loaded.issue_id, 100);
        assert_eq!(loaded.title, String::from_str(&env, "Fix critical bug"));
        assert_eq!(loaded.reward, 50_000_000);
        assert_eq!(loaded.contributor, None);
        assert_eq!(loaded.status, MilestoneStatus::Pending);
        assert_eq!(loaded.created_at, 1000);
        assert_eq!(loaded.released_at, None);
        assert_eq!(loaded.actual_released, 0);
    });
}

// ---------------------------------------------------------------------------
// storage – Admin
// ---------------------------------------------------------------------------

#[test]
fn test_storage_admin_roundtrip() {
    let (env, contract_id) = setup_env();

    let admin = Address::generate(&env);
    env.as_contract(&contract_id, || {
        storage::set_admin(&env, &admin);
    });

    env.as_contract(&contract_id, || {
        let loaded = storage::get_admin(&env);
        assert_eq!(loaded, Some(admin));
    });
}

#[test]
fn test_storage_admin_returns_none_when_not_set() {
    let (env, contract_id) = setup_env();

    env.as_contract(&contract_id, || {
        let loaded = storage::get_admin(&env);
        assert_eq!(loaded, None);
    });
}

// ---------------------------------------------------------------------------
// storage – Issue IDs
// ---------------------------------------------------------------------------

#[test]
fn test_storage_issue_ids_empty_initially() {
    let (env, contract_id) = setup_env();

    env.as_contract(&contract_id, || {
        let ids = storage::get_issue_ids(&env);
        assert_eq!(ids.len(), 0);
    });
}

#[test]
fn test_storage_issue_ids_push_and_retrieve() {
    let (env, contract_id) = setup_env();

    env.as_contract(&contract_id, || {
        storage::push_issue_id(&env, 10);
        storage::push_issue_id(&env, 20);
        storage::push_issue_id(&env, 30);

        let ids = storage::get_issue_ids(&env);
        assert_eq!(ids.len(), 3);
        assert_eq!(ids.get(0).unwrap(), 10);
        assert_eq!(ids.get(1).unwrap(), 20);
        assert_eq!(ids.get(2).unwrap(), 30);
    });
}

#[test]
fn test_storage_set_issue_ids() {
    let (env, contract_id) = setup_env();

    env.as_contract(&contract_id, || {
        let mut ids: Vec<u64> = Vec::new(&env);
        ids.push_back(1);
        ids.push_back(2);
        storage::set_issue_ids(&env, &ids);
    });

    env.as_contract(&contract_id, || {
        let loaded = storage::get_issue_ids(&env);
        assert_eq!(loaded.len(), 2);
        assert_eq!(loaded.get(0).unwrap(), 1);
        assert_eq!(loaded.get(1).unwrap(), 2);
    });
}

// ---------------------------------------------------------------------------
// storage – TTL extension
// ---------------------------------------------------------------------------

#[test]
fn test_ttl_extended_on_escrow_write() {
    let (env, contract_id) = setup_env();

    let escrow = EscrowState {
        repo_id: 1,
        maintainer: Address::generate(&env),
        platform: Address::generate(&env),
        token: Address::generate(&env),
        total_deposited: 0,
        reserved: 0,
        total_released: 0,
        created_at: 100,
        is_active: true,
    };

    env.as_contract(&contract_id, || {
        storage::set_escrow(&env, &escrow);
        let ttl = env
            .storage()
            .persistent()
            .get_ttl(&storage::StorageKey::Escrow);
        assert!(ttl >= 100_000);
    });
}

#[test]
fn test_ttl_extended_on_milestone_write() {
    let (env, contract_id) = setup_env();

    let milestone = Milestone {
        issue_id: 1,
        title: String::from_str(&env, "Test"),
        reward: 100_000_000,
        contributor: None,
        status: MilestoneStatus::Pending,
        created_at: 100,
        released_at: None,
        actual_released: 0,
    };

    env.as_contract(&contract_id, || {
        storage::set_milestone(&env, 1, &milestone);
        let ttl = env
            .storage()
            .persistent()
            .get_ttl(&storage::StorageKey::Milestone(1));
        assert!(ttl >= 100_000);
    });
}

#[test]
fn test_ttl_extended_on_admin_write() {
    let (env, contract_id) = setup_env();

    let admin = Address::generate(&env);
    env.as_contract(&contract_id, || {
        storage::set_admin(&env, &admin);
        let ttl = env
            .storage()
            .persistent()
            .get_ttl(&storage::StorageKey::Admin);
        assert!(ttl >= 100_000);
    });
}

#[test]
fn test_ttl_extended_on_issue_ids_write() {
    let (env, contract_id) = setup_env();

    env.as_contract(&contract_id, || {
        storage::push_issue_id(&env, 42);
        let ttl = env
            .storage()
            .persistent()
            .get_ttl(&storage::StorageKey::EscrowIssueIds);
        assert!(ttl >= 100_000);
    });
}

// ---------------------------------------------------------------------------
// milestone lifecycle
// ---------------------------------------------------------------------------

#[test]
fn test_create_milestone_reserves_funds_and_lists_issue() {
    let (env, contract_id) = setup_env();
    let (c, _, _, _) = initialize_with_funding(&env, &contract_id, 100_000_000);

    let title = String::from_str(&env, "Ship milestone lifecycle");
    let result = c.try_create_milestone(&101, &title, &40_000_000);
    assert!(result.is_ok());

    let milestone = c.get_milestone(&101);
    assert_eq!(milestone.issue_id, 101);
    assert_eq!(milestone.title, title);
    assert_eq!(milestone.reward, 40_000_000);
    assert_eq!(milestone.contributor, None);
    assert_eq!(milestone.status, MilestoneStatus::Pending);

    let escrow = c.get_escrow();
    assert_eq!(escrow.reserved, 40_000_000);

    let balance = c.get_balance();
    assert_eq!(balance.available, 60_000_000);

    let milestones = c.list_milestones();
    assert_eq!(milestones.len(), 1);
    assert_eq!(milestones.get(0).unwrap().issue_id, 101);
}

#[test]
fn test_create_milestone_rejects_underfunded_and_duplicate_issue() {
    let (env, contract_id) = setup_env();
    let (c, _, _, _) = initialize_with_funding(&env, &contract_id, 50_000_000);

    let title = String::from_str(&env, "Too expensive");
    let result = c.try_create_milestone(&102, &title, &60_000_000);
    assert_contract_err(result, ContractError::InsufficientBalance);

    let result = c.try_create_milestone(&102, &title, &30_000_000);
    assert!(result.is_ok());
    let result = c.try_create_milestone(&102, &title, &10_000_000);
    assert_contract_err(result, ContractError::DuplicateIssueId);
}

#[test]
fn test_assign_and_reassign_contributor_require_valid_state() {
    let (env, contract_id) = setup_env();
    let (c, _, _, _) = initialize_with_funding(&env, &contract_id, 100_000_000);
    let title = String::from_str(&env, "Assign contributor");
    let contributor = Address::generate(&env);
    let replacement = Address::generate(&env);

    let result = c.try_create_milestone(&103, &title, &25_000_000);
    assert!(result.is_ok());

    let result = c.try_reassign_contributor(&103, &replacement);
    assert_contract_err(result, ContractError::MilestoneNotActive);

    let result = c.try_assign_contributor(&103, &contributor);
    assert!(result.is_ok());
    let milestone = c.get_milestone(&103);
    assert_eq!(milestone.status, MilestoneStatus::Active);
    assert_eq!(milestone.contributor, Some(contributor));

    let result = c.try_assign_contributor(&103, &replacement);
    assert_contract_err(result, ContractError::MilestoneNotPending);

    let result = c.try_reassign_contributor(&103, &replacement);
    assert!(result.is_ok());
    let milestone = c.get_milestone(&103);
    assert_eq!(milestone.status, MilestoneStatus::Active);
    assert_eq!(milestone.contributor, Some(replacement));
}

#[test]
fn test_cancel_milestone_returns_reserved_funds_to_available_pool() {
    let (env, contract_id) = setup_env();
    let (c, _, _, _) = initialize_with_funding(&env, &contract_id, 100_000_000);
    let title = String::from_str(&env, "Cancel milestone");
    let contributor = Address::generate(&env);

    let result = c.try_create_milestone(&104, &title, &40_000_000);
    assert!(result.is_ok());
    let result = c.try_assign_contributor(&104, &contributor);
    assert!(result.is_ok());

    let result = c.try_cancel_milestone(&104);
    assert!(result.is_ok());

    let milestone = c.get_milestone(&104);
    assert_eq!(milestone.status, MilestoneStatus::Cancelled);
    assert_eq!(milestone.contributor, Some(contributor));

    let escrow = c.get_escrow();
    assert_eq!(escrow.reserved, 0);
    let balance = c.get_balance();
    assert_eq!(balance.available, 100_000_000);

    let result = c.try_reassign_contributor(&104, &Address::generate(&env));
    assert_contract_err(result, ContractError::MilestoneNotActive);
    let result = c.try_cancel_milestone(&104);
    assert_contract_err(result, ContractError::MilestoneNotActive);
}

#[test]
fn test_create_milestone_requires_platform_auth() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    let (_maintainer, platform, token) = addresses(&env);

    env.as_contract(&contract_id, || {
        let escrow = EscrowState {
            repo_id: 1,
            maintainer: Address::generate(&env),
            platform,
            token,
            total_deposited: 100_000_000,
            reserved: 0,
            total_released: 0,
            created_at: 12345,
            is_active: true,
        };
        storage::set_escrow(&env, &escrow);
    });

    let title = String::from_str(&env, "Unauthorized create");
    let result = c.try_create_milestone(&105, &title, &10_000_000);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// get_balance
// ---------------------------------------------------------------------------

#[test]
fn test_get_balance_after_initialize() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    let balance = c.get_balance();
    assert_eq!(balance.total_deposited, 0);
    assert_eq!(balance.reserved, 0);
    assert_eq!(balance.available, 0);
    assert_eq!(balance.total_released, 0);
}

// ---------------------------------------------------------------------------
// list_milestones
// ---------------------------------------------------------------------------

#[test]
fn test_list_milestones_empty_after_init() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    let milestones = c.list_milestones();
    assert_eq!(milestones.len(), 0);
}

// ---------------------------------------------------------------------------
// has_escrow
// ---------------------------------------------------------------------------

#[test]
fn test_has_escrow_before_and_after_init() {
    let (env, contract_id) = setup_env();

    env.as_contract(&contract_id, || {
        assert!(!storage::has_escrow(&env));
    });

    let c = client(&env, &contract_id);
    env.mock_all_auths();
    let (maintainer, platform, token) = addresses(&env);
    let result = c.try_initialize(&1, &maintainer, &platform, &token);
    assert!(result.is_ok());

    env.as_contract(&contract_id, || {
        assert!(storage::has_escrow(&env));
    });
}
