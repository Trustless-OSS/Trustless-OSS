#![no_std]

use soroban_sdk::{contract, contractimpl, Address, Env, String, Vec};

pub mod auth;
pub mod error;
pub mod events;
pub mod storage;
pub mod types;

#[cfg(test)]
mod test;

use error::ContractError;
use soroban_sdk::token;
use types::{BalanceInfo, EscrowState, Milestone, MilestoneStatus};

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
    pub fn deposit_funds(_env: Env, _amount: i128) -> Result<(), ContractError> {
        unimplemented!()
    }

    /// Withdraws unreserved USDC funds back to the maintainer.
    pub fn withdraw_funds(_env: Env, _amount: i128) -> Result<(), ContractError> {
        unimplemented!()
    }

    /// Creates a new pending milestone, reserving the specified reward amount.
    pub fn create_milestone(
        env: Env,
        issue_id: u64,
        title: String,
        reward: i128,
    ) -> Result<(), ContractError> {
        if reward <= 0 {
            return Err(ContractError::ZeroAmount);
        }

        let mut escrow = storage::get_escrow(&env)?;
        auth::require_active(&escrow)?;
        auth::require_platform(&env, &escrow)?;

        if storage::get_milestone(&env, issue_id).is_ok() {
            return Err(ContractError::DuplicateIssueId);
        }

        let available = escrow
            .total_deposited
            .checked_sub(escrow.reserved)
            .ok_or(ContractError::InsufficientBalance)?
            .checked_sub(escrow.total_released)
            .ok_or(ContractError::InsufficientBalance)?;
        if reward > available {
            return Err(ContractError::InsufficientBalance);
        }

        let milestone = Milestone {
            issue_id,
            title,
            reward,
            contributor: None,
            status: MilestoneStatus::Pending,
            created_at: env.ledger().timestamp(),
            released_at: None,
            actual_released: 0,
        };

        escrow.reserved = escrow
            .reserved
            .checked_add(reward)
            .ok_or(ContractError::InsufficientBalance)?;
        storage::set_escrow(&env, &escrow);
        storage::set_milestone(&env, issue_id, &milestone);
        storage::push_issue_id(&env, issue_id);
        events::emit_milestone_created(&env, issue_id, reward);

        Ok(())
    }

    /// Assigns a contributor to a pending milestone and moves it to active status.
    pub fn assign_contributor(
        env: Env,
        issue_id: u64,
        contributor: Address,
    ) -> Result<(), ContractError> {
        let escrow = storage::get_escrow(&env)?;
        auth::require_active(&escrow)?;
        auth::require_platform(&env, &escrow)?;

        let mut milestone = storage::get_milestone(&env, issue_id)?;
        if milestone.status != MilestoneStatus::Pending {
            return Err(ContractError::MilestoneNotPending);
        }

        milestone.contributor = Some(contributor.clone());
        milestone.status = MilestoneStatus::Active;
        storage::set_milestone(&env, issue_id, &milestone);
        events::emit_contributor_assigned(&env, issue_id, contributor);

        Ok(())
    }

    /// Reassigns an active milestone to a new contributor.
    pub fn reassign_contributor(
        env: Env,
        issue_id: u64,
        new_contributor: Address,
    ) -> Result<(), ContractError> {
        let escrow = storage::get_escrow(&env)?;
        auth::require_active(&escrow)?;
        auth::require_platform(&env, &escrow)?;

        let mut milestone = storage::get_milestone(&env, issue_id)?;
        if milestone.status != MilestoneStatus::Active {
            return Err(ContractError::MilestoneNotActive);
        }

        milestone.contributor = Some(new_contributor.clone());
        storage::set_milestone(&env, issue_id, &milestone);
        events::emit_contributor_reassigned(&env, issue_id, new_contributor);

        Ok(())
    }

    /// Releases the fully reserved reward amount to the assigned contributor upon completion.
    pub fn release_funds(env: Env, issue_id: u64) -> Result<(), ContractError> {
        let mut escrow = storage::get_escrow(&env)?;
        auth::require_active(&escrow)?;
        auth::require_platform(&env, &escrow)?;

        let mut milestone = storage::get_milestone(&env, issue_id)?;
        if milestone.status != MilestoneStatus::Active {
            return Err(ContractError::MilestoneNotActive);
        }
        let contributor = milestone
            .contributor
            .clone()
            .ok_or(ContractError::ContributorNotSet)?;

        // Token transfer: contract -> contributor.
        token::Client::new(&env, &escrow.token).transfer(
            &env.current_contract_address(),
            &contributor,
            &milestone.reward,
        );

        // Accounting: reserved -= reward, total_released += reward.
        escrow.reserved = escrow
            .reserved
            .checked_sub(milestone.reward)
            .ok_or(ContractError::InsufficientBalance)?;
        escrow.total_released = escrow
            .total_released
            .checked_add(milestone.reward)
            .ok_or(ContractError::InsufficientBalance)?;
        milestone.status = MilestoneStatus::Released;
        milestone.released_at = Some(env.ledger().timestamp());
        milestone.actual_released = milestone.reward;

        storage::set_escrow(&env, &escrow);
        storage::set_milestone(&env, issue_id, &milestone);
        events::emit_funds_released(&env, issue_id, contributor, milestone.reward);

        Ok(())
    }

    /// Releases a partial reward amount to the contributor and returns the remainder to the available pool.
    pub fn partial_release(
        env: Env,
        issue_id: u64,
        release_amount: i128,
    ) -> Result<(), ContractError> {
        if release_amount <= 0 {
            return Err(ContractError::ZeroAmount);
        }

        let mut escrow = storage::get_escrow(&env)?;
        auth::require_active(&escrow)?;
        auth::require_platform(&env, &escrow)?;

        let mut milestone = storage::get_milestone(&env, issue_id)?;
        if milestone.status != MilestoneStatus::Active {
            return Err(ContractError::MilestoneNotActive);
        }
        let contributor = milestone
            .contributor
            .clone()
            .ok_or(ContractError::ContributorNotSet)?;

        if release_amount > milestone.reward {
            return Err(ContractError::ReleaseTooLarge);
        }

        let returned_to_pool = milestone
            .reward
            .checked_sub(release_amount)
            .ok_or(ContractError::InsufficientBalance)?;

        token::Client::new(&env, &escrow.token).transfer(
            &env.current_contract_address(),
            &contributor,
            &release_amount,
        );

        escrow.reserved = escrow
            .reserved
            .checked_sub(milestone.reward)
            .ok_or(ContractError::InsufficientBalance)?;
        escrow.total_released = escrow
            .total_released
            .checked_add(release_amount)
            .ok_or(ContractError::InsufficientBalance)?;
        milestone.status = MilestoneStatus::Released;
        milestone.released_at = Some(env.ledger().timestamp());
        milestone.actual_released = release_amount;

        storage::set_escrow(&env, &escrow);
        storage::set_milestone(&env, issue_id, &milestone);
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
    pub fn cancel_milestone(env: Env, issue_id: u64) -> Result<(), ContractError> {
        let mut escrow = storage::get_escrow(&env)?;
        auth::require_active(&escrow)?;
        auth::require_platform(&env, &escrow)?;

        let mut milestone = storage::get_milestone(&env, issue_id)?;
        // Cancellation is allowed from Pending (no contributor yet) or Active (was assigned
        // but won't complete); once Released or Cancelled the funds are already off the
        // reserved pool and a second cancel would silently no-op or underflow.
        if milestone.status != MilestoneStatus::Pending
            && milestone.status != MilestoneStatus::Active
        {
            return Err(ContractError::MilestoneNotActive);
        }

        escrow.reserved = escrow
            .reserved
            .checked_sub(milestone.reward)
            .ok_or(ContractError::InsufficientBalance)?;
        milestone.status = MilestoneStatus::Cancelled;
        storage::set_escrow(&env, &escrow);
        storage::set_milestone(&env, issue_id, &milestone);
        events::emit_milestone_cancelled(&env, issue_id);

        Ok(())
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
