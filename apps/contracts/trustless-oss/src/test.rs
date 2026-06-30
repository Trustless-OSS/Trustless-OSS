#![cfg(test)]

use soroban_sdk::testutils::storage::Persistent as _;
use soroban_sdk::testutils::Events as _;

use super::*;
use crate::error::ContractError;
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
        contributor: PayoutTarget {
            payout_type: 2,
            stellar_address: None,
            destination_domain: 0,
            recipient: BytesN::from_array(&env, &[0u8; 32]),
        },
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
        assert_eq!(loaded.contributor.payout_type, 2);
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
        contributor: PayoutTarget {
            payout_type: 2,
            stellar_address: None,
            destination_domain: 0,
            recipient: BytesN::from_array(&env, &[0u8; 32]),
        },
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
// release_funds edge cases
// ---------------------------------------------------------------------------

#[test]
fn test_release_funds_not_active_panics() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    c.try_initialize(&1, &maintainer, &platform, &token)
        .unwrap();

    let milestone = Milestone {
        issue_id: 1,
        title: String::from_str(&env, "Test"),
        reward: 100,
        contributor: PayoutTarget {
            payout_type: 0,
            stellar_address: Some(Address::generate(&env)),
            destination_domain: 0,
            recipient: BytesN::from_array(&env, &[0u8; 32]),
        },
        status: MilestoneStatus::Pending,
        created_at: 100,
        released_at: None,
        actual_released: 0,
    };
    env.as_contract(&contract_id, || {
        storage::set_milestone(&env, 1, &milestone);
    });

    let result = c.try_release_funds(&1);
    assert!(result.is_err());
}

#[test]
fn test_release_funds_contributor_not_set() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    c.try_initialize(&1, &maintainer, &platform, &token)
        .unwrap();

    let milestone = Milestone {
        issue_id: 2,
        title: String::from_str(&env, "Test 2"),
        reward: 100,
        contributor: PayoutTarget {
            payout_type: 2,
            stellar_address: None,
            destination_domain: 0,
            recipient: BytesN::from_array(&env, &[0u8; 32]),
        },
        status: MilestoneStatus::Active,
        created_at: 100,
        released_at: None,
        actual_released: 0,
    };
    env.as_contract(&contract_id, || {
        storage::set_milestone(&env, 2, &milestone);
    });

    let result = c.try_release_funds(&2);
    assert!(result.is_err());
}

#[test]
fn test_partial_release_too_large() {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let (maintainer, platform, token) = addresses(&env);
    c.try_initialize(&1, &maintainer, &platform, &token)
        .unwrap();

    let milestone = Milestone {
        issue_id: 3,
        title: String::from_str(&env, "Test 3"),
        reward: 100,
        contributor: PayoutTarget {
            payout_type: 0,
            stellar_address: Some(Address::generate(&env)),
            destination_domain: 0,
            recipient: BytesN::from_array(&env, &[0u8; 32]),
        },
        status: MilestoneStatus::Active,
        created_at: 100,
        released_at: None,
        actual_released: 0,
    };
    env.as_contract(&contract_id, || {
        storage::set_milestone(&env, 3, &milestone);
    });

    let result = c.try_partial_release(&3, &150);
    assert!(result.is_err());
}

// ---------------------------------------------------------------------------
// Funding mechanics – helpers
// ---------------------------------------------------------------------------

struct FundingSetup {
    env: Env,
    contract_id: Address,
    client: TrustlessOssContractClient<'static>,
    maintainer: Address,
    token: Address,
}

fn setup_funding_env(initial_mint: i128) -> FundingSetup {
    let (env, contract_id) = setup_env();
    let c = client(&env, &contract_id);
    env.mock_all_auths();

    let maintainer = Address::generate(&env);
    let platform = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = token_contract.address();

    c.try_initialize(&1, &maintainer, &platform, &token)
        .unwrap()
        .unwrap();

    if initial_mint > 0 {
        let sac = token::StellarAssetClient::new(&env, &token);
        sac.mint(&maintainer, &initial_mint);
    }

    FundingSetup {
        env,
        contract_id,
        client: c,
        maintainer,
        token,
    }
}

// ---------------------------------------------------------------------------
// deposit_funds
// ---------------------------------------------------------------------------

#[test]
fn test_deposit_funds_success() {
    let setup = setup_funding_env(500);
    let token_client = token::Client::new(&setup.env, &setup.token);

    setup.client.try_deposit_funds(&200).unwrap().unwrap();

    let escrow = setup.client.get_escrow();
    assert_eq!(escrow.total_deposited, 200);

    let balance = setup.client.get_balance();
    assert_eq!(balance.total_deposited, 200);
    assert_eq!(balance.available, 200);

    assert_eq!(token_client.balance(&setup.contract_id), 200);
    assert_eq!(token_client.balance(&setup.maintainer), 300);
}

#[test]
fn test_deposit_emits_event() {
    let setup = setup_funding_env(100);
    let events_before = setup.env.events().all().len();

    setup.client.try_deposit_funds(&50).unwrap().unwrap();

    assert!(setup.env.events().all().len() > events_before);
}

#[test]
fn test_deposit_zero_amount_panics() {
    let setup = setup_funding_env(100);
    let result = setup.client.try_deposit_funds(&0);
    assert_eq!(result.unwrap_err().unwrap(), ContractError::ZeroAmount);
}

#[test]
fn test_deposit_negative_amount_panics() {
    let setup = setup_funding_env(100);
    let result = setup.client.try_deposit_funds(&-1);
    assert_eq!(result.unwrap_err().unwrap(), ContractError::ZeroAmount);
}

#[test]
#[should_panic(expected = "Unauthorized function call for address")]
fn test_deposit_requires_maintainer() {
    let setup = setup_funding_env(100);
    setup.env.set_auths(&[]);
    setup.client.deposit_funds(&50);
}

// ---------------------------------------------------------------------------
// withdraw_funds
// ---------------------------------------------------------------------------

#[test]
fn test_withdraw_funds_success() {
    let setup = setup_funding_env(1_000);
    setup.client.try_deposit_funds(&1_000).unwrap().unwrap();

    let token_client = token::Client::new(&setup.env, &setup.token);

    setup.client.try_withdraw_funds(&400).unwrap().unwrap();

    let escrow = setup.client.get_escrow();
    assert_eq!(escrow.total_deposited, 600);

    let balance = setup.client.get_balance();
    assert_eq!(balance.available, 600);

    assert_eq!(token_client.balance(&setup.contract_id), 600);
    assert_eq!(token_client.balance(&setup.maintainer), 400);
}

#[test]
fn test_withdraw_up_to_available() {
    let setup = setup_funding_env(500);
    setup.client.try_deposit_funds(&500).unwrap().unwrap();

    setup.client.try_withdraw_funds(&500).unwrap().unwrap();

    let balance = setup.client.get_balance();
    assert_eq!(balance.available, 0);
    assert_eq!(balance.total_deposited, 0);
}

#[test]
fn test_withdraw_exceeds_available_panics() {
    let setup = setup_funding_env(500);
    setup.client.try_deposit_funds(&500).unwrap().unwrap();

    let result = setup.client.try_withdraw_funds(&501);
    assert_eq!(
        result.unwrap_err().unwrap(),
        ContractError::WithdrawExceedsAvailable
    );
}

#[test]
fn test_withdraw_zero_amount_panics() {
    let setup = setup_funding_env(500);
    setup.client.try_deposit_funds(&500).unwrap().unwrap();

    let result = setup.client.try_withdraw_funds(&0);
    assert_eq!(result.unwrap_err().unwrap(), ContractError::ZeroAmount);
}

#[test]
fn test_withdraw_respects_reserved() {
    let setup = setup_funding_env(1_000);
    setup.client.try_deposit_funds(&1_000).unwrap().unwrap();

    setup.env.as_contract(&setup.contract_id, || {
        let mut escrow = storage::get_escrow(&setup.env).unwrap();
        escrow.reserved = 300;
        storage::set_escrow(&setup.env, &escrow);

        let milestone = Milestone {
            issue_id: 99,
            title: String::from_str(&setup.env, "Reserved milestone"),
            reward: 300,
            contributor: PayoutTarget {
                payout_type: 0,
                stellar_address: Some(Address::generate(&setup.env)),
                destination_domain: 0,
                recipient: BytesN::from_array(&setup.env, &[0u8; 32]),
            },
            status: MilestoneStatus::Active,
            created_at: 100,
            released_at: None,
            actual_released: 0,
        };
        storage::set_milestone(&setup.env, 99, &milestone);
    });

    let balance = setup.client.get_balance();
    assert_eq!(balance.available, 700);

    setup.client.try_withdraw_funds(&700).unwrap().unwrap();

    let result = setup.client.try_withdraw_funds(&1);
    assert_eq!(
        result.unwrap_err().unwrap(),
        ContractError::WithdrawExceedsAvailable
    );
}

#[test]
#[should_panic(expected = "Unauthorized function call for address")]
fn test_withdraw_requires_maintainer() {
    let setup = setup_funding_env(500);
    setup.client.try_deposit_funds(&500).unwrap().unwrap();

    setup.env.set_auths(&[]);
    setup.client.withdraw_funds(&100);
}

use soroban_sdk::Symbol;

#[contract]
pub struct MockTokenMessengerMinter;

#[contractimpl]
impl MockTokenMessengerMinter {
    pub fn set_contract(env: Env, contract: Address) {
        env.storage().instance().set(&Symbol::new(&env, "contract"), &contract);
    }

    pub fn deposit_for_burn(
        env: Env,
        amount: i128,
        _destination_domain: u32,
        _mint_recipient: BytesN<32>,
        burn_token: Address,
    ) -> BytesN<32> {
        let contract: Address = env.storage().instance().get(&Symbol::new(&env, "contract")).unwrap();
        let usdc_client = token::Client::new(&env, &burn_token);
        usdc_client.transfer_from(&env.current_contract_address(), &contract, &env.current_contract_address(), &amount);
        
        BytesN::from_array(&env, &[1u8; 32])
    }
}

#[test]
fn test_release_funds_cctp_success() {
    let setup = setup_funding_env(1_000);
    setup.client.try_deposit_funds(&1_000).unwrap().unwrap();

    let minter_address = Address::from_string(
        &soroban_sdk::String::from_str(&setup.env, "CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP"),
    );
    setup.env.register_contract(&minter_address, MockTokenMessengerMinter);
    let minter_client = MockTokenMessengerMinterClient::new(&setup.env, &minter_address);
    minter_client.set_contract(&setup.contract_id);

    let recipient = BytesN::from_array(&setup.env, &[2u8; 32]);
    setup.env.as_contract(&setup.contract_id, || {
        let milestone = Milestone {
            issue_id: 1,
            title: String::from_str(&setup.env, "Test CCTP"),
            reward: 500,
            contributor: PayoutTarget {
                payout_type: 1,
                stellar_address: None,
                destination_domain: 6,
                recipient: recipient.clone(),
            },
            status: MilestoneStatus::Active,
            created_at: 100,
            released_at: None,
            actual_released: 0,
        };
        storage::set_milestone(&setup.env, 1, &milestone);
        
        let mut escrow = storage::get_escrow(&setup.env).unwrap();
        escrow.reserved += 500;
        storage::set_escrow(&setup.env, &escrow);
    });

    setup.client.try_release_funds(&1).unwrap().unwrap();

    let milestone = setup.client.get_milestone(&1);
    assert_eq!(milestone.status, MilestoneStatus::Released);
    assert_eq!(milestone.actual_released, 500);

    let token_client = token::Client::new(&setup.env, &setup.token);
    assert_eq!(token_client.balance(&minter_address), 500);
    assert_eq!(token_client.balance(&setup.contract_id), 500);
}

#[test]
fn test_partial_release_cctp_success() {
    let setup = setup_funding_env(1_000);
    setup.client.try_deposit_funds(&1_000).unwrap().unwrap();

    let minter_address = Address::from_string(
        &soroban_sdk::String::from_str(&setup.env, "CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP"),
    );
    setup.env.register_contract(&minter_address, MockTokenMessengerMinter);
    let minter_client = MockTokenMessengerMinterClient::new(&setup.env, &minter_address);
    minter_client.set_contract(&setup.contract_id);

    let recipient = BytesN::from_array(&setup.env, &[2u8; 32]);
    setup.env.as_contract(&setup.contract_id, || {
        let milestone = Milestone {
            issue_id: 1,
            title: String::from_str(&setup.env, "Test CCTP Partial"),
            reward: 500,
            contributor: PayoutTarget {
                payout_type: 1,
                stellar_address: None,
                destination_domain: 6,
                recipient: recipient.clone(),
            },
            status: MilestoneStatus::Active,
            created_at: 100,
            released_at: None,
            actual_released: 0,
        };
        storage::set_milestone(&setup.env, 1, &milestone);
        
        let mut escrow = storage::get_escrow(&setup.env).unwrap();
        escrow.reserved += 500;
        storage::set_escrow(&setup.env, &escrow);
    });

    setup.client.try_partial_release(&1, &400).unwrap().unwrap();

    let milestone = setup.client.get_milestone(&1);
    assert_eq!(milestone.status, MilestoneStatus::Released);
    assert_eq!(milestone.actual_released, 400);

    let token_client = token::Client::new(&setup.env, &setup.token);
    assert_eq!(token_client.balance(&minter_address), 400);
    assert_eq!(token_client.balance(&setup.contract_id), 600);
}

#[test]
fn test_release_funds_cctp_invalid_domain() {
    let setup = setup_funding_env(1_000);
    setup.client.try_deposit_funds(&1_000).unwrap().unwrap();

    let minter_address = Address::from_string(
        &soroban_sdk::String::from_str(&setup.env, "CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP"),
    );
    setup.env.register_contract(&minter_address, MockTokenMessengerMinter);
    let minter_client = MockTokenMessengerMinterClient::new(&setup.env, &minter_address);
    minter_client.set_contract(&setup.contract_id);

    let recipient = BytesN::from_array(&setup.env, &[2u8; 32]);
    setup.env.as_contract(&setup.contract_id, || {
        let milestone = Milestone {
            issue_id: 1,
            title: String::from_str(&setup.env, "Test"),
            reward: 500,
            contributor: PayoutTarget {
                payout_type: 1,
                stellar_address: None,
                destination_domain: 99, // Invalid
                recipient: recipient.clone(),
            },
            status: MilestoneStatus::Active,
            created_at: 100,
            released_at: None,
            actual_released: 0,
        };
        storage::set_milestone(&setup.env, 1, &milestone);
    });

    let result = setup.client.try_release_funds(&1);
    assert_eq!(result.unwrap_err().unwrap(), ContractError::InvalidCctpDomain);
}

#[test]
fn test_release_funds_cctp_invalid_recipient() {
    let setup = setup_funding_env(1_000);
    setup.client.try_deposit_funds(&1_000).unwrap().unwrap();

    let minter_address = Address::from_string(
        &soroban_sdk::String::from_str(&setup.env, "CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP"),
    );
    setup.env.register_contract(&minter_address, MockTokenMessengerMinter);
    let minter_client = MockTokenMessengerMinterClient::new(&setup.env, &minter_address);
    minter_client.set_contract(&setup.contract_id);

    let recipient = BytesN::from_array(&setup.env, &[0u8; 32]); // All zeroes
    setup.env.as_contract(&setup.contract_id, || {
        let milestone = Milestone {
            issue_id: 1,
            title: String::from_str(&setup.env, "Test"),
            reward: 500,
            contributor: PayoutTarget {
                payout_type: 1,
                stellar_address: None,
                destination_domain: 6,
                recipient: recipient.clone(),
            },
            status: MilestoneStatus::Active,
            created_at: 100,
            released_at: None,
            actual_released: 0,
        };
        storage::set_milestone(&setup.env, 1, &milestone);
    });

    let result = setup.client.try_release_funds(&1);
    assert_eq!(result.unwrap_err().unwrap(), ContractError::InvalidCctpRecipient);
}

#[test]
fn test_release_funds_cctp_precision_loss() {
    let setup = setup_funding_env(1_000);
    setup.client.try_deposit_funds(&1_000).unwrap().unwrap();

    let minter_address = Address::from_string(
        &soroban_sdk::String::from_str(&setup.env, "CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP"),
    );
    setup.env.register_contract(&minter_address, MockTokenMessengerMinter);
    let minter_client = MockTokenMessengerMinterClient::new(&setup.env, &minter_address);
    minter_client.set_contract(&setup.contract_id);

    let recipient = BytesN::from_array(&setup.env, &[2u8; 32]);
    setup.env.as_contract(&setup.contract_id, || {
        let milestone = Milestone {
            issue_id: 1,
            title: String::from_str(&setup.env, "Test"),
            reward: 505, // Not multiple of 10
            contributor: PayoutTarget {
                payout_type: 1,
                stellar_address: None,
                destination_domain: 6,
                recipient: recipient.clone(),
            },
            status: MilestoneStatus::Active,
            created_at: 100,
            released_at: None,
            actual_released: 0,
        };
        storage::set_milestone(&setup.env, 1, &milestone);
    });

    let result = setup.client.try_release_funds(&1);
    assert_eq!(result.unwrap_err().unwrap(), ContractError::CctpAmountPrecisionLoss);
}
