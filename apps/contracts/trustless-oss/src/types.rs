use soroban_sdk::{contracttype, Address, BytesN, String};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PayoutTarget {
    pub payout_type: u32, // 0 = Stellar address, 1 = CCTP
    pub stellar_address: Option<Address>,
    pub destination_domain: u32,
    pub recipient: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MilestoneStatus {
    Pending,   // created on-chain, no contributor assigned yet
    Active,    // contributor assigned, funds hard-locked
    Released,  // full or partial amount sent to contributor
    Cancelled, // unassigned or PR closed without merge — funds returned to pool
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub issue_id: u64,
    pub title: String,
    pub reward: i128, // in stroops (1 USDC = 10_000_000)
    pub contributor: PayoutTarget,
    pub status: MilestoneStatus,
    pub created_at: u64, // ledger timestamp
    pub released_at: Option<u64>,
    pub actual_released: i128, // 0 unless partial_release was used
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EscrowState {
    pub repo_id: u64,
    pub maintainer: Address,
    pub platform: Address,
    pub token: Address, // USDC SAC address
    pub total_deposited: i128,
    pub reserved: i128,       // sum of rewards for Pending + Active milestones
    pub total_released: i128, // cumulative released to contributors
    pub created_at: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BalanceInfo {
    pub total_deposited: i128,
    pub reserved: i128,
    pub available: i128, // total_deposited - reserved - total_released
    pub total_released: i128,
}
