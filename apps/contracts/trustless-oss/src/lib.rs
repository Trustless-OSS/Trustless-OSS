#![no_std]

use soroban_sdk::{contract, contractimpl, panic_with_error, Address, Env, String, Vec};

pub mod auth;
pub mod error;
pub mod events;
pub mod storage;
pub mod types;

#[cfg(test)]
mod test;

use error::ContractError;
use types::{BalanceInfo, EscrowState, Milestone};

#[contract]
pub struct TrustlessOssContract;

#[contractimpl]
impl TrustlessOssContract {
    pub fn initialize(
        env: Env,
        repo_id: u64,
        admin: Address,
        maintainer: Address,
        platform: Address,
        token: Address,
    ) {
        admin.require_auth();

        let stored_admin = storage::get_admin(&env);
        if let Some(stored) = stored_admin {
            if admin != stored {
                panic_with_error!(&env, ContractError::NotAdmin);
            }
        } else {
            storage::set_admin(&env, &admin);
        }

        if storage::has_escrow(&env) {
            panic_with_error!(&env, ContractError::EscrowAlreadyExists);
        }

        let escrow = EscrowState {
            repo_id,
            maintainer: maintainer.clone(),
            platform,
            token,
            total_deposited: 0,
            reserved: 0,
            total_released: 0,
            created_at: env.ledger().timestamp(),
            is_active: true,
        };

        storage::set_escrow(&env, &escrow);
        storage::set_issue_ids(&env, &Vec::new(&env));

        events::emit_escrow_initialized(&env, repo_id, maintainer);
    }

    pub fn deposit_funds(_env: Env, _amount: i128) {
        unimplemented!()
    }

    pub fn withdraw_funds(_env: Env, _amount: i128) {
        unimplemented!()
    }

    pub fn create_milestone(_env: Env, _issue_id: u64, _title: String, _reward: i128) {
        unimplemented!()
    }

    pub fn assign_contributor(_env: Env, _issue_id: u64, _contributor: Address) {
        unimplemented!()
    }

    pub fn reassign_contributor(_env: Env, _issue_id: u64, _new_contributor: Address) {
        unimplemented!()
    }

    pub fn release_funds(_env: Env, _issue_id: u64) {
        unimplemented!()
    }

    pub fn partial_release(_env: Env, _issue_id: u64, _release_amount: i128) {
        unimplemented!()
    }

    pub fn cancel_milestone(_env: Env, _issue_id: u64) {
        unimplemented!()
    }

    pub fn get_escrow(env: Env) -> EscrowState {
        storage::get_escrow(&env)
    }

    pub fn get_milestone(env: Env, issue_id: u64) -> Milestone {
        storage::get_milestone(&env, issue_id)
    }

    pub fn get_balance(env: Env) -> BalanceInfo {
        let escrow = storage::get_escrow(&env);
        let total_deposited = escrow.total_deposited;
        let reserved = escrow.reserved;
        let total_released = escrow.total_released;
        let available = total_deposited
            .checked_sub(reserved)
            .unwrap_or(0)
            .checked_sub(total_released)
            .unwrap_or(0);
        BalanceInfo {
            total_deposited,
            reserved,
            available,
            total_released,
        }
    }

    pub fn list_milestones(env: Env) -> Vec<Milestone> {
        let issue_ids = storage::get_issue_ids(&env);
        let mut milestones: Vec<Milestone> = Vec::new(&env);
        for i in 0..issue_ids.len() {
            let id = issue_ids.get(i).unwrap();
            milestones.push_back(storage::get_milestone(&env, id));
        }
        milestones
    }
}
