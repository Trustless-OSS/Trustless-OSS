#![no_std]

use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, Env, String, Vec};

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
    /// Initializes the single-repo escrow state with the maintainer, platform, and token configurations.
    pub fn initialize(
        env: Env,
        repo_id: u64,
        maintainer: Address,
        platform: Address,
        token: Address,
    ) -> Result<(), ContractError> {
        if storage::has_escrow(&env) {
            return Err(ContractError::EscrowAlreadyExists);
        }

        let stored_admin = storage::get_admin(&env);
        if let Some(admin) = stored_admin {
            admin.require_auth();
        } else {
            maintainer.require_auth();
            storage::set_admin(&env, &maintainer);
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

        Ok(())
    }

    /// Deposits USDC into the contract to fund upcoming milestones.
    pub fn deposit_funds(env: Env, amount: i128) -> Result<(), ContractError> {
        let mut escrow = storage::get_escrow(&env)?;
        auth::require_maintainer(&env, &escrow);
        auth::require_active(&env, &escrow);

        if amount <= 0 {
            panic_with_error!(&env, ContractError::ZeroAmount);
        }

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&escrow.maintainer, &env.current_contract_address(), &amount);

        escrow.total_deposited += amount;
        storage::set_escrow(&env, &escrow);
        events::emit_funds_deposited(&env, amount, escrow.total_deposited);

        Ok(())
    }

    /// Withdraws unreserved USDC funds back to the maintainer.
    pub fn withdraw_funds(_env: Env, _amount: i128) -> Result<(), ContractError> {
        unimplemented!()
    }

    /// Creates a new pending milestone, reserving the specified reward amount.
    pub fn create_milestone(
        _env: Env,
        _issue_id: u64,
        _title: String,
        _reward: i128,
    ) -> Result<(), ContractError> {
        unimplemented!()
    }

    /// Assigns a contributor to a pending milestone and moves it to active status.
    pub fn assign_contributor(
        _env: Env,
        _issue_id: u64,
        _contributor: Address,
    ) -> Result<(), ContractError> {
        unimplemented!()
    }

    /// Reassigns an active milestone to a new contributor.
    pub fn reassign_contributor(
        _env: Env,
        _issue_id: u64,
        _new_contributor: Address,
    ) -> Result<(), ContractError> {
        unimplemented!()
    }

    /// Releases the fully reserved reward amount to the assigned contributor upon completion.
    pub fn release_funds(env: Env, issue_id: u64) -> Result<(), ContractError> {
        let mut escrow = storage::get_escrow(&env)?;
        auth::require_platform(&env, &escrow);
        auth::require_active(&env, &escrow);

        let mut milestone = storage::get_milestone(&env, issue_id)?;

        if milestone.status != types::MilestoneStatus::Active {
            panic_with_error!(&env, ContractError::MilestoneNotActive);
        }

        let reward = milestone.reward;
        let contributor = milestone
            .contributor
            .clone()
            .ok_or(ContractError::ContributorNotSet)?;

        escrow.reserved -= reward;
        escrow.total_released += reward;

        milestone.status = types::MilestoneStatus::Released;
        milestone.actual_released = reward;
        milestone.released_at = Some(env.ledger().timestamp());

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &contributor, &reward);

        storage::set_escrow(&env, &escrow);
        storage::set_milestone(&env, issue_id, &milestone);

        events::emit_funds_released(&env, issue_id, contributor, reward);

        Ok(())
    }

    /// Releases a partial reward amount to the contributor and returns the remainder to the available pool.
    pub fn partial_release(
        env: Env,
        issue_id: u64,
        release_amount: i128,
    ) -> Result<(), ContractError> {
        let mut escrow = storage::get_escrow(&env)?;
        auth::require_platform(&env, &escrow);
        auth::require_active(&env, &escrow);

        let mut milestone = storage::get_milestone(&env, issue_id)?;

        if milestone.status != types::MilestoneStatus::Active {
            panic_with_error!(&env, ContractError::MilestoneNotActive);
        }

        if release_amount > milestone.reward {
            panic_with_error!(&env, ContractError::ReleaseTooLarge);
        }

        let contributor = milestone
            .contributor
            .clone()
            .ok_or(ContractError::ContributorNotSet)?;

        escrow.reserved -= milestone.reward;
        escrow.total_released += release_amount;

        milestone.status = types::MilestoneStatus::Released;
        milestone.actual_released = release_amount;
        milestone.released_at = Some(env.ledger().timestamp());

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(
            &env.current_contract_address(),
            &contributor,
            &release_amount,
        );

        storage::set_escrow(&env, &escrow);
        storage::set_milestone(&env, issue_id, &milestone);

        let returned_to_pool = milestone.reward - release_amount;
        events::emit_partial_release(
            &env,
            issue_id,
            contributor,
            release_amount,
            returned_to_pool,
        );

        Ok(())
    }

    /// Cancels a milestone and un-reserves the funds, returning them to the available pool.
    pub fn cancel_milestone(_env: Env, _issue_id: u64) -> Result<(), ContractError> {
        unimplemented!()
    }

    /// Retrieves the global state for this repository's escrow.
    pub fn get_escrow(env: Env) -> Result<EscrowState, ContractError> {
        storage::get_escrow(&env)
    }

    /// Retrieves the details and current status of a specific milestone by its issue ID.
    pub fn get_milestone(env: Env, issue_id: u64) -> Result<Milestone, ContractError> {
        storage::get_milestone(&env, issue_id)
    }

    /// Returns the overall balance information including deposited, reserved, and available amounts.
    pub fn get_balance(env: Env) -> Result<BalanceInfo, ContractError> {
        let escrow = storage::get_escrow(&env)?;
        let total_deposited = escrow.total_deposited;
        let reserved = escrow.reserved;
        let total_released = escrow.total_released;
        let available = total_deposited
            .checked_sub(reserved)
            .unwrap_or(0)
            .checked_sub(total_released)
            .unwrap_or(0);
        Ok(BalanceInfo {
            total_deposited,
            reserved,
            available,
            total_released,
        })
    }

    /// Lists all milestones that have been created for this repository.
    pub fn list_milestones(env: Env) -> Result<Vec<Milestone>, ContractError> {
        let issue_ids = storage::get_issue_ids(&env);
        let mut milestones: Vec<Milestone> = Vec::new(&env);
        for i in 0..issue_ids.len() {
            let id = issue_ids.get(i).unwrap();
            milestones.push_back(storage::get_milestone(&env, id)?);
        }
        Ok(milestones)
    }
}
