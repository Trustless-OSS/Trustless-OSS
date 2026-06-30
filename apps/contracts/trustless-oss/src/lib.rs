#![no_std]

use soroban_sdk::{contract, contractimpl, panic_with_error, token, Address, Env, String, Vec, BytesN};

pub mod auth;
pub mod error;
pub mod events;
pub mod storage;
pub mod types;

#[cfg(test)]
mod test;

use error::ContractError;
use types::{BalanceInfo, EscrowState, Milestone, PayoutTarget, MilestoneStatus};

const CCTP_TOKEN_MESSENGER_MINTER: &str = "CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP";

#[soroban_sdk::contractclient(name = "TokenMessengerMinterClient")]
pub trait TokenMessengerMinter {
    fn deposit_for_burn(
        env: Env,
        amount: i128,
        destination_domain: u32,
        mint_recipient: BytesN<32>,
        burn_token: Address,
    ) -> BytesN<32>;
}

fn is_supported_cctp_domain(domain: u32) -> bool {
    matches!(
        domain,
        0 | 1 | 2 | 3 | 5 | 6 | 7 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 21 | 22 | 25 | 26 | 28 | 29 | 30 | 31 | 32
    )
}

fn execute_payout(
    env: &Env,
    token: &Address,
    target: &PayoutTarget,
    amount: i128,
) -> Result<(), ContractError> {
    if target.payout_type == 0 {
        let recipient_address = target.stellar_address.clone().ok_or(ContractError::ContributorNotSet)?;
        let token_client = token::Client::new(env, token);
        token_client.transfer(&env.current_contract_address(), &recipient_address, &amount);
        Ok(())
    } else if target.payout_type == 1 {
        if !is_supported_cctp_domain(target.destination_domain) {
            return Err(ContractError::InvalidCctpDomain);
        }
        let zero_bytes = BytesN::from_array(env, &[0u8; 32]);
        if target.recipient == zero_bytes {
            return Err(ContractError::InvalidCctpRecipient);
        }
        if amount % 10 != 0 {
            return Err(ContractError::CctpAmountPrecisionLoss);
        }

        let minter_address = Address::from_string(
            &soroban_sdk::String::from_str(env, CCTP_TOKEN_MESSENGER_MINTER),
        );

        let token_client = token::Client::new(env, token);
        token_client.approve(
            &env.current_contract_address(),
            &minter_address,
            &amount,
            &(env.ledger().sequence() + 100),
        );

        let minter_client = TokenMessengerMinterClient::new(env, &minter_address);
        minter_client.deposit_for_burn(&amount, &target.destination_domain, &target.recipient, token);

        Ok(())
    } else {
        Err(ContractError::ContributorNotSet)
    }
}

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
    pub fn withdraw_funds(env: Env, amount: i128) -> Result<(), ContractError> {
        let mut escrow = storage::get_escrow(&env)?;
        auth::require_maintainer(&env, &escrow);
        auth::require_active(&env, &escrow);

        if amount <= 0 {
            panic_with_error!(&env, ContractError::ZeroAmount);
        }

        let available = escrow
            .total_deposited
            .checked_sub(escrow.reserved)
            .unwrap_or(0)
            .checked_sub(escrow.total_released)
            .unwrap_or(0);

        if amount > available {
            panic_with_error!(&env, ContractError::WithdrawExceedsAvailable);
        }

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &escrow.maintainer, &amount);

        escrow.total_deposited -= amount;
        storage::set_escrow(&env, &escrow);

        let new_available = escrow
            .total_deposited
            .checked_sub(escrow.reserved)
            .unwrap_or(0)
            .checked_sub(escrow.total_released)
            .unwrap_or(0);
        events::emit_funds_withdrawn(&env, amount, new_available);

        Ok(())
    }

    /// Creates a new pending milestone, reserving the specified reward amount.
    pub fn create_milestone(
        env: Env,
        issue_id: u64,
        title: String,
        reward: i128,
    ) -> Result<(), ContractError> {
        let mut escrow = storage::get_escrow(&env)?;
        auth::require_maintainer(&env, &escrow);
        auth::require_active(&env, &escrow);

        if reward <= 0 {
            panic_with_error!(&env, ContractError::ZeroAmount);
        }

        if storage::get_milestone(&env, issue_id).is_ok() {
            return Err(ContractError::DuplicateIssueId);
        }

        let balance = Self::get_balance(env.clone())?;
        if reward > balance.available {
            return Err(ContractError::InsufficientBalance);
        }

        let milestone = Milestone {
            issue_id,
            title,
            reward,
            contributor: PayoutTarget {
                payout_type: 2,
                stellar_address: None,
                destination_domain: 0,
                recipient: BytesN::from_array(&env, &[0u8; 32]),
            },
            status: MilestoneStatus::Pending,
            created_at: env.ledger().timestamp(),
            released_at: None,
            actual_released: 0,
        };

        escrow.reserved += reward;
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
        contributor: PayoutTarget,
    ) -> Result<(), ContractError> {
        let escrow = storage::get_escrow(&env)?;
        auth::require_maintainer(&env, &escrow);
        auth::require_active(&env, &escrow);

        let mut milestone = storage::get_milestone(&env, issue_id)?;

        if milestone.status != MilestoneStatus::Pending {
            return Err(ContractError::MilestoneNotPending);
        }

        milestone.contributor = contributor.clone();
        milestone.status = MilestoneStatus::Active;
        storage::set_milestone(&env, issue_id, &milestone);

        events::emit_contributor_assigned(&env, issue_id, contributor);

        Ok(())
    }

    /// Reassigns an active milestone to a new contributor.
    pub fn reassign_contributor(
        env: Env,
        issue_id: u64,
        new_contributor: PayoutTarget,
    ) -> Result<(), ContractError> {
        let escrow = storage::get_escrow(&env)?;
        auth::require_maintainer(&env, &escrow);
        auth::require_active(&env, &escrow);

        let mut milestone = storage::get_milestone(&env, issue_id)?;

        if milestone.status != MilestoneStatus::Active {
            return Err(ContractError::MilestoneNotActive);
        }

        milestone.contributor = new_contributor.clone();
        storage::set_milestone(&env, issue_id, &milestone);

        events::emit_contributor_reassigned(&env, issue_id, new_contributor);

        Ok(())
    }

    /// Releases the fully reserved reward amount to the assigned contributor upon completion.
    pub fn release_funds(env: Env, issue_id: u64) -> Result<(), ContractError> {
        let mut escrow = storage::get_escrow(&env)?;
        auth::require_platform(&env, &escrow);
        auth::require_active(&env, &escrow);

        let mut milestone = storage::get_milestone(&env, issue_id)?;

        if milestone.status != MilestoneStatus::Active {
            panic_with_error!(&env, ContractError::MilestoneNotActive);
        }

        let reward = milestone.reward;
        let contributor = milestone.contributor.clone();
        if contributor.payout_type == 2 {
            return Err(ContractError::ContributorNotSet);
        }

        escrow.reserved -= reward;
        escrow.total_released += reward;

        milestone.status = MilestoneStatus::Released;
        milestone.actual_released = reward;
        milestone.released_at = Some(env.ledger().timestamp());

        execute_payout(&env, &escrow.token, &contributor, reward)?;

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

        if milestone.status != MilestoneStatus::Active {
            panic_with_error!(&env, ContractError::MilestoneNotActive);
        }

        if release_amount > milestone.reward {
            panic_with_error!(&env, ContractError::ReleaseTooLarge);
        }

        let contributor = milestone.contributor.clone();
        if contributor.payout_type == 2 {
            return Err(ContractError::ContributorNotSet);
        }

        escrow.reserved -= milestone.reward;
        escrow.total_released += release_amount;

        milestone.status = MilestoneStatus::Released;
        milestone.actual_released = release_amount;
        milestone.released_at = Some(env.ledger().timestamp());

        execute_payout(&env, &escrow.token, &contributor, release_amount)?;

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
    pub fn cancel_milestone(env: Env, issue_id: u64) -> Result<(), ContractError> {
        let mut escrow = storage::get_escrow(&env)?;
        auth::require_maintainer(&env, &escrow);
        auth::require_active(&env, &escrow);

        let mut milestone = storage::get_milestone(&env, issue_id)?;

        if milestone.status != MilestoneStatus::Pending && milestone.status != MilestoneStatus::Active {
            return Err(ContractError::MilestoneNotActive);
        }

        escrow.reserved -= milestone.reward;
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
