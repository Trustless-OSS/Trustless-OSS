use soroban_sdk::{Address, Env};

pub fn emit_escrow_initialized(_env: &Env, _repo_id: u64, _maintainer: Address) {
    unimplemented!()
}

pub fn emit_funds_deposited(_env: &Env, _amount: i128, _new_total: i128) {
    unimplemented!()
}

pub fn emit_funds_withdrawn(_env: &Env, _amount: i128, _new_available: i128) {
    unimplemented!()
}

pub fn emit_milestone_created(_env: &Env, _issue_id: u64, _reward: i128) {
    unimplemented!()
}

pub fn emit_contributor_assigned(_env: &Env, _issue_id: u64, _contributor: Address) {
    unimplemented!()
}

pub fn emit_contributor_reassigned(_env: &Env, _issue_id: u64, _new_contributor: Address) {
    unimplemented!()
}

pub fn emit_funds_released(_env: &Env, _issue_id: u64, _contributor: Address, _amount: i128) {
    unimplemented!()
}

pub fn emit_partial_release(
    _env: &Env,
    _issue_id: u64,
    _contributor: Address,
    _released: i128,
    _returned_to_pool: i128,
) {
    unimplemented!()
}

pub fn emit_milestone_cancelled(_env: &Env, _issue_id: u64) {
    unimplemented!()
}
