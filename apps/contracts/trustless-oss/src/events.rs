#![allow(deprecated)]

use soroban_sdk::{symbol_short, Address, Env, Symbol};

pub fn emit_escrow_initialized(env: &Env, repo_id: u64, maintainer: Address) {
    env.events().publish((symbol_short!("init"), repo_id), maintainer);
}

pub fn emit_funds_deposited(env: &Env, amount: i128, new_total: i128) {
    env.events().publish((symbol_short!("deposit"),), (amount, new_total));
}

pub fn emit_funds_withdrawn(env: &Env, amount: i128, new_available: i128) {
    env.events().publish((symbol_short!("withdraw"),), (amount, new_available));
}

pub fn emit_milestone_created(env: &Env, issue_id: u64, reward: i128) {
    env.events().publish((symbol_short!("created"), issue_id), reward);
}

pub fn emit_contributor_assigned(env: &Env, issue_id: u64, contributor: Address) {
    env.events().publish((symbol_short!("assign"), issue_id), contributor);
}

pub fn emit_contributor_reassigned(env: &Env, issue_id: u64, new_contributor: Address) {
    env.events().publish((symbol_short!("reassign"), issue_id), new_contributor);
}

pub fn emit_funds_released(env: &Env, issue_id: u64, contributor: Address, amount: i128) {
    env.events().publish((symbol_short!("release"), issue_id), (contributor, amount));
}

pub fn emit_partial_release(
    env: &Env,
    issue_id: u64,
    contributor: Address,
    released: i128,
    returned_to_pool: i128,
) {
    env.events().publish((Symbol::new(env, "part_rel"), issue_id), (contributor, released, returned_to_pool));
}

pub fn emit_milestone_cancelled(env: &Env, issue_id: u64) {
    env.events().publish((symbol_short!("cancel"), issue_id), ());
}
