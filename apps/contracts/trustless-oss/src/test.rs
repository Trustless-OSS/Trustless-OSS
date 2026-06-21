#![cfg(test)]

use soroban_sdk::testutils::storage::Persistent as _;
use soroban_sdk::testutils::Events as _;

use super::*;
use crate::types::MilestoneStatus;
use soroban_sdk::testutils::{Address as _, Ledger, LedgerInfo};
use soroban_sdk::{token, Address, Env, String, Vec};

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

/// Initializes the escrow AND wires up a real Stellar Asset token contract
/// so that `release_funds`/`partial_release` can perform real transfers.
/// Returns the escrow client, the maintainer, the platform, and a token
/// admin who can mint USDC to the contract for payout testing.
fn setup_with_token(
    env: &Env,
    contract_id: &soroban_sdk::Address,
    deposited: i128,
) -> (
    TrustlessOssContractClient<'static>,
    Address,
    Address,
    Address,
    token::Client<'static>,
    token::StellarAssetClient<'static>,
) {
    let c = client(env, contract_id);
    env.mock_all_auths();
    let (maintainer, platform, _token_addr) = addresses(env);

    // Deploy a real Stellar Asset token (USDC stand-in).
    let token_admin = Address::generate(env);
    let token_addr = env.register_stellar_asset_contract_v2(token_admin.clone());
    let sac = token::Client::new(env, &token_addr.address());
    let sac_admin = token::StellarAssetClient::new(env, &token_addr.address());

    let result = c.try_initialize(&1, &maintainer, &platform, &token_addr.address());
    assert!(result.is_ok());

    // Simulate a maintainer deposit by minting USDC to the escrow contract.
    if deposited > 0 {
        sac_admin.mint(&contract_id, &deposited);
        env.as_contract(contract_id, || {
            let mut escrow = storage::get_escrow(env).unwrap();
            escrow.total_deposited = deposited;
            storage::set_escrow(env, &escrow);
        });
    }

    (c, maintainer, platform, token_admin, sac, sac_admin)
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

// ---------------------------------------------------------------------------
// Milestone lifecycle — create_milestone
// ---------------------------------------------------------------------------

#[test]
fn test_create_milestone_success() {
    let (env, contract_id) = setup_env();
    let (c, _maintainer, _platform, _token_admin, _sac, _sac_admin) =
        setup_with_token(&env, &contract_id, 1_000_000_000);

    let result = c.try_create_milestone(
        &42,
        &String::from_str(&env, "Fix critical bug"),
        &50_000_000,
    );
    assert!(result.is_ok());

    let milestone = c.get_milestone(&42);
    assert_eq!(milestone.issue_id, 42);
    assert_eq!(milestone.title, String::from_str(&env, "Fix critical bug"));
    assert_eq!(milestone.reward, 50_000_000);
    assert_eq!(milestone.contributor, None);
    assert_eq!(milestone.status, MilestoneStatus::Pending);
    assert_eq!(milestone.actual_released, 0);
    assert_eq!(milestone.released_at, None);

    let escrow = c.get_escrow();
    assert_eq!(escrow.reserved, 50_000_000);

    let ids = c.list_milestones();
    assert_eq!(ids.len(), 1);
}

#[test]
fn test_create_milestone_rejects_zero_reward() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);
    let result = c.try_create_milestone(&1, &String::from_str(&env, "Free work"), &0);
    assert_contract_err(result, ContractError::ZeroAmount);
}

#[test]
fn test_create_milestone_rejects_negative_reward() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);
    let result = c.try_create_milestone(&1, &String::from_str(&env, "Negative"), &-100);
    assert_contract_err(result, ContractError::ZeroAmount);
}

#[test]
fn test_create_milestone_rejects_insufficient_funds() {
    let (env, contract_id) = setup_env();
    // Only 100 USDC deposited; trying to create a 1000 USDC milestone must fail.
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 100_000_000);
    let result = c.try_create_milestone(
        &1,
        &String::from_str(&env, "Over budget"),
        &1_000_000_000,
    );
    assert_contract_err(result, ContractError::InsufficientBalance);

    let escrow = c.get_escrow();
    assert_eq!(escrow.reserved, 0);
}

#[test]
fn test_create_milestone_rejects_duplicate_issue_id() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    let first = c.try_create_milestone(
        &42,
        &String::from_str(&env, "First"),
        &10_000_000,
    );
    assert!(first.is_ok());

    let dup = c.try_create_milestone(&42, &String::from_str(&env, "Dup"), &10_000_000);
    assert_contract_err(dup, ContractError::DuplicateIssueId);
}

#[test]
fn test_create_milestone_uses_checked_add_no_overflow() {
    let (env, contract_id) = setup_env();
    // Two milestones whose rewards sum exceeds i128 should not silently overflow.
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, i128::MAX);

    let result = c.try_create_milestone(
        &1,
        &String::from_str(&env, "Half"),
        &(i128::MAX / 2 + 1),
    );
    assert!(result.is_ok());

    let overflow = c.try_create_milestone(
        &2,
        &String::from_str(&env, "Overflow"),
        &(i128::MAX / 2 + 1),
    );
    assert_contract_err(overflow, ContractError::InsufficientBalance);
}

// ---------------------------------------------------------------------------
// Milestone lifecycle — assign_contributor / reassign_contributor
// ---------------------------------------------------------------------------

#[test]
fn test_assign_contributor_success() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();

    let contributor = Address::generate(&env);
    let result = c.try_assign_contributor(&10, &contributor);
    assert!(result.is_ok());

    let milestone = c.get_milestone(&10);
    assert_eq!(milestone.status, MilestoneStatus::Active);
    assert_eq!(milestone.contributor, Some(contributor));
}

#[test]
fn test_assign_contributor_rejects_non_pending() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    let contributor = Address::generate(&env);
    c.try_assign_contributor(&10, &contributor).unwrap();

    // Reassigning an already-assigned milestone via assign_contributor must fail.
    let other = Address::generate(&env);
    let result = c.try_assign_contributor(&10, &other);
    assert_contract_err(result, ContractError::MilestoneNotPending);
}

#[test]
fn test_reassign_contributor_success() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    let first = Address::generate(&env);
    c.try_assign_contributor(&10, &first).unwrap();

    let second = Address::generate(&env);
    let result = c.try_reassign_contributor(&10, &second);
    assert!(result.is_ok());

    let milestone = c.get_milestone(&10);
    assert_eq!(milestone.contributor, Some(second));
    assert_eq!(milestone.status, MilestoneStatus::Active);
}

#[test]
fn test_reassign_contributor_rejects_pending() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    // Pending -> reassign should fail (MilestoneNotActive guard).
    let result = c.try_reassign_contributor(&10, &Address::generate(&env));
    assert_contract_err(result, ContractError::MilestoneNotActive);
}

// ---------------------------------------------------------------------------
// Milestone lifecycle — cancel_milestone
// ---------------------------------------------------------------------------

#[test]
fn test_cancel_pending_milestone_unreserves() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    let result = c.try_cancel_milestone(&10);
    assert!(result.is_ok());

    let milestone = c.get_milestone(&10);
    assert_eq!(milestone.status, MilestoneStatus::Cancelled);
    let escrow = c.get_escrow();
    assert_eq!(escrow.reserved, 0);
}

#[test]
fn test_cancel_active_milestone_unreserves_and_keeps_contributor() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    let contributor = Address::generate(&env);
    c.try_assign_contributor(&10, &contributor).unwrap();
    c.try_cancel_milestone(&10).unwrap();

    let milestone = c.get_milestone(&10);
    assert_eq!(milestone.status, MilestoneStatus::Cancelled);
    // Contributor address is preserved for audit even after cancellation.
    assert_eq!(milestone.contributor, Some(contributor));

    let escrow = c.get_escrow();
    assert_eq!(escrow.reserved, 0);
}

#[test]
fn test_cancel_rejects_released_milestone() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    let contributor = Address::generate(&env);
    c.try_assign_contributor(&10, &contributor).unwrap();
    c.try_release_funds(&10).unwrap();

    // Once Released, the milestone is terminal — cancel must reject.
    let result = c.try_cancel_milestone(&10);
    assert_contract_err(result, ContractError::MilestoneNotActive);
}

#[test]
fn test_double_cancel_rejects() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    c.try_cancel_milestone(&10).unwrap();
    // Second cancel would silently underflow `reserved` — must be rejected.
    let result = c.try_cancel_milestone(&10);
    assert_contract_err(result, ContractError::MilestoneNotActive);
}

// ---------------------------------------------------------------------------
// Milestone lifecycle — release_funds / partial_release
// ---------------------------------------------------------------------------

#[test]
fn test_release_funds_transfers_full_reward() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, sac, sac_admin) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    let contributor = Address::generate(&env);
    c.try_assign_contributor(&10, &contributor).unwrap();

    let result = c.try_release_funds(&10);
    assert!(result.is_ok());

    // Contributor received full reward.
    assert_eq!(sac.balance(&contributor), 50_000_000);

    let milestone = c.get_milestone(&10);
    assert_eq!(milestone.status, MilestoneStatus::Released);
    assert_eq!(milestone.actual_released, 50_000_000);
    assert!(milestone.released_at.is_some());

    let escrow = c.get_escrow();
    assert_eq!(escrow.reserved, 0);
    assert_eq!(escrow.total_released, 50_000_000);

    // Suppress unused warning for sac_admin (referenced to keep the binding live).
    let _ = sac_admin;
}

#[test]
fn test_release_funds_rejects_non_active() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    // Pending -> release must fail.
    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    let result = c.try_release_funds(&10);
    assert_contract_err(result, ContractError::MilestoneNotActive);
}

#[test]
fn test_partial_release_transfers_partial_and_unreserves_full() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, sac, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &80_000_000)
        .unwrap();
    let contributor = Address::generate(&env);
    c.try_assign_contributor(&10, &contributor).unwrap();

    let result = c.try_partial_release(&10, &30_000_000);
    assert!(result.is_ok());

    assert_eq!(sac.balance(&contributor), 30_000_000);

    let milestone = c.get_milestone(&10);
    assert_eq!(milestone.status, MilestoneStatus::Released);
    assert_eq!(milestone.actual_released, 30_000_000);

    // Full reward is un-reserved even though only a portion was paid.
    let escrow = c.get_escrow();
    assert_eq!(escrow.reserved, 0);
    assert_eq!(escrow.total_released, 30_000_000);

    // The available pool now includes the un-released 50 USDC back.
    let balance = c.get_balance();
    assert_eq!(balance.available, 1_000_000_000 - 30_000_000);
}

#[test]
fn test_partial_release_rejects_zero() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    c.try_assign_contributor(&10, &Address::generate(&env)).unwrap();

    let result = c.try_partial_release(&10, &0);
    assert_contract_err(result, ContractError::ZeroAmount);
}

#[test]
fn test_partial_release_rejects_amount_greater_than_reward() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&10, &String::from_str(&env, "Task"), &50_000_000)
        .unwrap();
    c.try_assign_contributor(&10, &Address::generate(&env)).unwrap();

    let result = c.try_partial_release(&10, &51_000_000);
    assert_contract_err(result, ContractError::ReleaseTooLarge);
}
// ---------------------------------------------------------------------------
// Milestone lifecycle — fund-conservation invariant (the property-based
// invariant that this whole feature must preserve).
// ---------------------------------------------------------------------------

#[test]
fn test_fund_conservation_pending_then_cancel() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    // Reserve 30, 20, 10 = 60 from a 100 pool. Cancel them all.
    c.try_create_milestone(&1, &String::from_str(&env, "a"), &30_000_000)
        .unwrap();
    c.try_create_milestone(&2, &String::from_str(&env, "b"), &20_000_000)
        .unwrap();
    c.try_create_milestone(&3, &String::from_str(&env, "c"), &10_000_000)
        .unwrap();

    let escrow_mid = c.get_escrow();
    assert_eq!(escrow_mid.reserved, 60_000_000);

    c.try_cancel_milestone(&1).unwrap();
    c.try_cancel_milestone(&2).unwrap();
    c.try_cancel_milestone(&3).unwrap();

    // All reservations must be returned to the available pool.
    let balance = c.get_balance();
    assert_eq!(balance.total_deposited, 1_000_000_000);
    assert_eq!(balance.reserved, 0);
    assert_eq!(balance.total_released, 0);
    assert_eq!(balance.available, 1_000_000_000);
}

#[test]
fn test_fund_conservation_full_release_then_partial_release() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, sac, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    let contributor_a = Address::generate(&env);
    let contributor_b = Address::generate(&env);

    // Milestone A: 40 USDC, full release.
    c.try_create_milestone(&1, &String::from_str(&env, "A"), &40_000_000)
        .unwrap();
    c.try_assign_contributor(&1, &contributor_a).unwrap();
    c.try_release_funds(&1).unwrap();

    // Milestone B: 60 USDC, partial release 25.
    c.try_create_milestone(&2, &String::from_str(&env, "B"), &60_000_000)
        .unwrap();
    c.try_assign_contributor(&2, &contributor_b).unwrap();
    c.try_partial_release(&2, &25_000_000).unwrap();

    // Conservation: total_deposited = sum(released) + available.
    let balance = c.get_balance();
    assert_eq!(balance.total_deposited, 1_000_000_000);
    assert_eq!(balance.reserved, 0);
    assert_eq!(balance.total_released, 40_000_000 + 25_000_000);
    assert_eq!(balance.available, 1_000_000_000 - 65_000_000);

    // Both contributors received exactly what the contract says they did.
    assert_eq!(sac.balance(&contributor_a), 40_000_000);
    assert_eq!(sac.balance(&contributor_b), 25_000_000);
}

#[test]
fn test_list_milestones_after_lifecycle() {
    let (env, contract_id) = setup_env();
    let (c, _m, _p, _t, _s, _sa) = setup_with_token(&env, &contract_id, 1_000_000_000);

    c.try_create_milestone(&1, &String::from_str(&env, "a"), &10_000_000)
        .unwrap();
    c.try_create_milestone(&2, &String::from_str(&env, "b"), &20_000_000)
        .unwrap();
    c.try_create_milestone(&3, &String::from_str(&env, "c"), &30_000_000)
        .unwrap();

    c.try_assign_contributor(&2, &Address::generate(&env)).unwrap();
    c.try_release_funds(&2).unwrap();

    let milestones = c.list_milestones();
    assert_eq!(milestones.len(), 3);
    assert_eq!(milestones.get(0).unwrap().status, MilestoneStatus::Pending);
    assert_eq!(milestones.get(1).unwrap().status, MilestoneStatus::Released);
    assert_eq!(milestones.get(2).unwrap().status, MilestoneStatus::Pending);
}
