use crate::types::{EscrowState, Milestone};
use soroban_sdk::{contracttype, Address, Env, Vec};

#[contracttype]
pub enum StorageKey {
    Escrow,         // EscrowState
    Milestone(u64), // issue_id → Milestone
    EscrowIssueIds, // Vec<u64>
    Admin,          // Address — can call initialize_escrow
}

pub fn get_escrow(_env: &Env) -> EscrowState {
    unimplemented!()
}

pub fn set_escrow(_env: &Env, _escrow: &EscrowState) {
    unimplemented!()
}

pub fn get_milestone(_env: &Env, _issue_id: u64) -> Milestone {
    unimplemented!()
}

pub fn set_milestone(_env: &Env, _issue_id: u64, _milestone: &Milestone) {
    unimplemented!()
}

pub fn get_issue_ids(_env: &Env) -> Vec<u64> {
    unimplemented!()
}

pub fn push_issue_id(_env: &Env, _issue_id: u64) {
    unimplemented!()
}

pub fn get_admin(_env: &Env) -> Option<Address> {
    unimplemented!()
}

pub fn set_admin(_env: &Env, _admin: &Address) {
    unimplemented!()
}
