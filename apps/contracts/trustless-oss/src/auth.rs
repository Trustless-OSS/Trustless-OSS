use crate::types::EscrowState;
use soroban_sdk::{Env, panic_with_error};

pub fn require_platform(_env: &Env, escrow: &EscrowState) {
    escrow.platform.require_auth();
}

pub fn require_maintainer(_env: &Env, escrow: &EscrowState) {
    escrow.maintainer.require_auth();
}

pub fn require_active(env: &Env, escrow: &EscrowState) {
    if !escrow.is_active {
        panic_with_error!(env, crate::error::ContractError::EscrowInactive);
    }
}
