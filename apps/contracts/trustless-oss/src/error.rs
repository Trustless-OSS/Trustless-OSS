use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    // Auth
    NotAdmin = 1,
    NotPlatform = 2,
    NotMaintainer = 3,

    // Escrow
    EscrowNotFound = 10,
    EscrowAlreadyExists = 11,
    EscrowInactive = 12,

    // Balance
    InsufficientBalance = 20, // deposit would leave pool underfunded
    WithdrawExceedsAvailable = 21,
    ZeroAmount = 22,

    // Milestone
    MilestoneNotFound = 30,
    MilestoneNotPending = 31, // assign_contributor requires Pending
    MilestoneNotActive = 32,  // release/cancel requires Active
    DuplicateIssueId = 33,
    ReleaseTooLarge = 34, // partial_release amount > milestone reward

    // Contributor
    ContributorNotSet = 40,

    // CCTP
    InvalidCctpDomain = 50,
    InvalidCctpRecipient = 51,
    CctpAmountPrecisionLoss = 52,
}
