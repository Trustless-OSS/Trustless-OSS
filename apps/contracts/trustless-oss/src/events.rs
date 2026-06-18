use soroban_sdk::{Address, Env, Symbol};

pub fn emit_escrow_initialized(env: &Env, repo_id: u64, maintainer: Address) {
    let topics = (Symbol::new(env, "escrow_initialized"), repo_id, maintainer);
    env.events().publish(topics, ());
}

pub fn emit_funds_deposited(env: &Env, amount: i128, new_total: i128) {
    let topics = (Symbol::new(env, "funds_deposited"), amount, new_total);
    env.events().publish(topics, ());
}

pub fn emit_funds_withdrawn(env: &Env, amount: i128, new_available: i128) {
    let topics = (Symbol::new(env, "funds_withdrawn"), amount, new_available);
    env.events().publish(topics, ());
}

pub fn emit_milestone_created(env: &Env, issue_id: u64, reward: i128) {
    let topics = (Symbol::new(env, "milestone_created"), issue_id, reward);
    env.events().publish(topics, ());
}

pub fn emit_contributor_assigned(env: &Env, issue_id: u64, contributor: Address) {
    let topics = (
        Symbol::new(env, "contributor_assigned"),
        issue_id,
        contributor,
    );
    env.events().publish(topics, ());
}

pub fn emit_contributor_reassigned(env: &Env, issue_id: u64, new_contributor: Address) {
    let topics = (
        Symbol::new(env, "contributor_reassigned"),
        issue_id,
        new_contributor,
    );
    env.events().publish(topics, ());
}

pub fn emit_funds_released(env: &Env, issue_id: u64, contributor: Address, amount: i128) {
    let topics = (
        Symbol::new(env, "funds_released"),
        issue_id,
        contributor,
        amount,
    );
    env.events().publish(topics, ());
}

pub fn emit_partial_release(
    env: &Env,
    issue_id: u64,
    contributor: Address,
    released: i128,
    returned_to_pool: i128,
) {
    let topics = (
        Symbol::new(env, "partial_release"),
        issue_id,
        contributor,
        released,
        returned_to_pool,
    );
    env.events().publish(topics, ());
}

pub fn emit_milestone_cancelled(env: &Env, issue_id: u64) {
    let topics = (Symbol::new(env, "milestone_cancelled"), issue_id);
    env.events().publish(topics, ());
}
