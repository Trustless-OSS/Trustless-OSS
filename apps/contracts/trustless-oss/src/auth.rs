use soroban_sdk::Env;
use crate::types::EscrowState;

pub fn require_platform(_env: &Env, _escrow: &EscrowState) {
    unimplemented!()
}

pub fn require_maintainer(_env: &Env, _escrow: &EscrowState) {
    unimplemented!()
}

pub fn require_active(_escrow: &EscrowState) {
    unimplemented!()
}
