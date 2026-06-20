use crate::error::ContractError;
use crate::types::EscrowState;
use soroban_sdk::Env;

/// Requires authorization from the platform account configured for the escrow.
pub fn require_platform(_env: &Env, escrow: &EscrowState) -> Result<(), ContractError> {
    escrow.platform.require_auth();
    Ok(())
}

/// Requires authorization from the maintainer account configured for the escrow.
pub fn require_maintainer(_env: &Env, escrow: &EscrowState) -> Result<(), ContractError> {
    escrow.maintainer.require_auth();
    Ok(())
}

/// Rejects lifecycle operations when the escrow has been deactivated.
pub fn require_active(escrow: &EscrowState) -> Result<(), ContractError> {
    if !escrow.is_active {
        return Err(ContractError::EscrowInactive);
    }
    Ok(())
}
