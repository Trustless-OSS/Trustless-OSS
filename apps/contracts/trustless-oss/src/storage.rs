use crate::types::{EscrowState, Milestone};
use soroban_sdk::{contracttype, Address, Env, Vec};

#[contracttype]
pub enum StorageKey {
    Escrow,         // EscrowState
    Milestone(u64), // issue_id → Milestone
    EscrowIssueIds, // Vec<u64>
    Admin,          // Address — can call initialize_escrow
}

pub fn get_escrow(env: &Env) -> EscrowState {
    env.storage().instance().get(&StorageKey::Escrow).unwrap()
}

pub fn set_escrow(env: &Env, escrow: &EscrowState) {
    env.storage().instance().set(&StorageKey::Escrow, escrow);
}

pub fn get_milestone(env: &Env, issue_id: u64) -> Milestone {
    env.storage().instance().get(&StorageKey::Milestone(issue_id)).unwrap()
}

pub fn set_milestone(env: &Env, issue_id: u64, milestone: &Milestone) {
    env.storage().instance().set(&StorageKey::Milestone(issue_id), milestone);
}

pub fn get_issue_ids(env: &Env) -> Vec<u64> {
    env.storage().instance().get(&StorageKey::EscrowIssueIds).unwrap_or(Vec::new(env))
}

pub fn push_issue_id(env: &Env, issue_id: u64) {
    let mut ids = get_issue_ids(env);
    ids.push_back(issue_id);
    env.storage().instance().set(&StorageKey::EscrowIssueIds, &ids);
}

pub fn get_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&StorageKey::Admin)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&StorageKey::Admin, admin);
}
