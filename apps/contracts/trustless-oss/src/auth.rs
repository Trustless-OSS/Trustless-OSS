use crate::error::ContractError;
use crate::types::EscrowState;
use soroban_sdk::Env;

/// Requires authorization from the platform account configured for the escrow.
/// The platform wallet signs milestone lifecycle operations that mutate the
/// global escrow state (e.g. releasing reserved funds).
pub fn require_platform(_env: &Env, escrow: &EscrowState) -> Result<(), ContractError> {
    escrow.platform.require_auth();
    Ok(())
}

/// Requires authorization from the maintainer account configured for the escrow.
/// The maintainer is the GitHub repo owner; they sign milestone lifecycle
/// operations that scope per-issue (e.g. creating a milestone, assigning a
/// contributor, cancelling).
pub fn require_maintainer(_env: &Env, escrow: &EscrowState) -> Result<(), ContractError> {
    escrow.maintainer.require_auth();
    Ok(())
}

/// Rejects lifecycle operations when the escrow has been deactivated.
/// Use this guard on every function that mutates `EscrowState` or `Milestone`
/// to prevent state changes after the escrow is paused.
pub fn require_active(escrow: &EscrowState) -> Result<(), ContractError> {
    if !escrow.is_active {
        return Err(ContractError::EscrowInactive);
    }
    Ok(())
}
