use crate::types::{EscrowState, Milestone};
use soroban_sdk::{contracttype, Address, Env, Vec};

const TTL_MIN: u32 = 100_000;
const TTL_MAX: u32 = 100_000;

#[contracttype]
pub enum StorageKey {
    Escrow,
    Milestone(u64),
    EscrowIssueIds,
    Admin,
}

pub fn get_escrow(env: &Env) -> EscrowState {
    let key = StorageKey::Escrow;
    env.storage()
        .persistent()
        .get(&key)
        .expect("escrow not found")
}

pub fn set_escrow(env: &Env, escrow: &EscrowState) {
    let key = StorageKey::Escrow;
    env.storage().persistent().set(&key, escrow);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_MIN, TTL_MAX);
}

pub fn has_escrow(env: &Env) -> bool {
    let key = StorageKey::Escrow;
    env.storage().persistent().has(&key)
}

pub fn get_milestone(env: &Env, issue_id: u64) -> Milestone {
    let key = StorageKey::Milestone(issue_id);
    env.storage()
        .persistent()
        .get(&key)
        .expect("milestone not found")
}

pub fn set_milestone(env: &Env, issue_id: u64, milestone: &Milestone) {
    let key = StorageKey::Milestone(issue_id);
    env.storage().persistent().set(&key, milestone);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_MIN, TTL_MAX);
}

pub fn get_issue_ids(env: &Env) -> Vec<u64> {
    let key = StorageKey::EscrowIssueIds;
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env))
}

pub fn push_issue_id(env: &Env, issue_id: u64) {
    let key = StorageKey::EscrowIssueIds;
    let mut ids: Vec<u64> = env
        .storage()
        .persistent()
        .get(&key)
        .unwrap_or(Vec::new(env));
    ids.push_back(issue_id);
    env.storage().persistent().set(&key, &ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_MIN, TTL_MAX);
}

pub fn set_issue_ids(env: &Env, ids: &Vec<u64>) {
    let key = StorageKey::EscrowIssueIds;
    env.storage().persistent().set(&key, ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_MIN, TTL_MAX);
}

pub fn get_admin(env: &Env) -> Option<Address> {
    let key = StorageKey::Admin;
    env.storage().persistent().get(&key)
}

pub fn set_admin(env: &Env, admin: &Address) {
    let key = StorageKey::Admin;
    env.storage().persistent().set(&key, admin);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_MIN, TTL_MAX);
}
