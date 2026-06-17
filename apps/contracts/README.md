# Trustless-OSS Soroban Contract — AI Agent Implementation Prompt

> Paste this entire file into Claude Code (or any AI coding agent) and say:
> "Implement this Soroban smart contract exactly as specified."

---

## Project Context

You are implementing a **Soroban smart contract** for Trustless-OSS — a GitHub-integrated OSS bounty platform on Stellar. The contract manages per-repo USDC escrow pools, milestone-based fund locking, and automated payouts triggered by PR merges.

The backend is a NestJS app that listens to GitHub webhooks and calls this contract via `@stellar/stellar-sdk`. The platform wallet is the sole transaction signer for all on-chain actions post-setup.

---

## Architecture Decisions (Non-Negotiable)

| Decision           | Value                                                      | Reason                                 |
| ------------------ | ---------------------------------------------------------- | -------------------------------------- |
| Fees               | None (`fee = 0`)                                           | Platform charges no cut                |
| Maintainer signing | Only for `deposit_funds` + `withdraw_funds`                | Everything else is platform wallet     |
| Release signer     | Platform wallet only                                       | Auto-triggered by webhook handler      |
| Partial release    | Platform wallet calls it with maintainer-instructed amount | dApp collects amount, platform submits |
| Contract structure | Single contract, multiple repos via `escrow_id`            | Avoid per-repo deployment cost         |
| Token              | USDC (SAC — Stellar Asset Contract)                        | Passed in at `initialize_escrow`       |
| Gas                | Platform wallet holds XLM, never deducted from USDC pool   | XLM and USDC are separate assets       |
| Storage            | Soroban `instance` + `persistent` storage                  | Per function notes below               |

---

## File Structure to Create

```
apps/contracts/trustless-oss/
├── Cargo.toml
└── src/
    ├── lib.rs        ← contract entry point, all 12 functions
    ├── types.rs      ← EscrowState, Milestone, MilestoneStatus, BalanceInfo
    ├── error.rs      ← ContractError enum
    ├── events.rs     ← all event emitters
    ├── storage.rs    ← storage key enum + read/write helpers
    ├── auth.rs       ← require_platform(), require_maintainer()
    └── test.rs       ← unit tests for all functions
```

---

## Cargo.toml

```toml
[package]
name = "trustless-oss"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
soroban-sdk = { version = "21.0.0", features = ["alloc"] }

[dev-dependencies]
soroban-sdk = { version = "21.0.0", features = ["testutils", "alloc"] }

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
```

---

## Data Structures (`types.rs`)

```rust
use soroban_sdk::{contracttype, Address, String};

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub enum MilestoneStatus {
    Pending,    // created on-chain, no contributor assigned yet
    Active,     // contributor assigned, funds hard-locked
    Released,   // full or partial amount sent to contributor
    Cancelled,  // unassigned or PR closed without merge — funds returned to pool
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub issue_id: u64,
    pub title: String,
    pub reward: i128,               // in stroops (1 USDC = 10_000_000)
    pub contributor: Option<Address>,
    pub status: MilestoneStatus,
    pub created_at: u64,            // ledger timestamp
    pub released_at: Option<u64>,
    pub actual_released: i128,      // 0 unless partial_release was used
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EscrowState {
    pub repo_id: u64,
    pub maintainer: Address,
    pub platform: Address,
    pub token: Address,             // USDC SAC address
    pub total_deposited: i128,
    pub reserved: i128,             // sum of rewards for Pending + Active milestones
    pub total_released: i128,       // cumulative released to contributors
    pub created_at: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BalanceInfo {
    pub total_deposited: i128,
    pub reserved: i128,
    pub available: i128,            // total_deposited - reserved - total_released
    pub total_released: i128,
}
```

---

## Storage Keys (`storage.rs`)

```rust
use soroban_sdk::{contracttype, BytesN};

#[contracttype]
pub enum StorageKey {
    Escrow(BytesN<32>),                    // escrow_id → EscrowState
    Milestone(BytesN<32>, u64),            // (escrow_id, issue_id) → Milestone
    EscrowIssueIds(BytesN<32>),            // escrow_id → Vec<u64>
    Admin,                                 // Address — can call initialize_escrow
}
```

Storage TTL notes:

- `EscrowState` → `persistent` storage (must survive ledger expiry)
- `Milestone` → `persistent` storage
- `EscrowIssueIds` → `persistent` storage
- `Admin` → `instance` storage

Implement `get_escrow`, `set_escrow`, `get_milestone`, `set_milestone`,
`get_issue_ids`, `push_issue_id` helpers in `storage.rs`.
Always `extend_ttl` on every read/write for persistent entries.

---

## Error Codes (`error.rs`)

```rust
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    // Auth
    NotAdmin            = 1,
    NotPlatform         = 2,
    NotMaintainer       = 3,

    // Escrow
    EscrowNotFound      = 10,
    EscrowAlreadyExists = 11,
    EscrowInactive      = 12,

    // Balance
    InsufficientBalance = 20,   // deposit would leave pool underfunded
    WithdrawExceedsAvailable = 21,
    ZeroAmount          = 22,

    // Milestone
    MilestoneNotFound   = 30,
    MilestoneNotPending = 31,   // assign_contributor requires Pending
    MilestoneNotActive  = 32,   // release/cancel requires Active
    DuplicateIssueId    = 33,
    ReleaseTooLarge     = 34,   // partial_release amount > milestone reward

    // Contributor
    ContributorNotSet   = 40,
}
```

---

## Events (`events.rs`)

Emit one event per state-changing function. Backend listens via `stellar-sdk` event streaming.

```rust
// Topics format: (event_name_symbol, escrow_id)
// Data: relevant fields as a tuple

pub fn emit_escrow_initialized(env, escrow_id, repo_id, maintainer);
pub fn emit_funds_deposited(env, escrow_id, amount, new_total);
pub fn emit_funds_withdrawn(env, escrow_id, amount, new_available);
pub fn emit_milestone_created(env, escrow_id, issue_id, reward);
pub fn emit_contributor_assigned(env, escrow_id, issue_id, contributor);
pub fn emit_funds_released(env, escrow_id, issue_id, contributor, amount);
pub fn emit_partial_release(env, escrow_id, issue_id, contributor, released, returned_to_pool);
pub fn emit_milestone_cancelled(env, escrow_id, issue_id);
```

---

## Auth Helpers (`auth.rs`)

```rust
// Panics with ContractError::NotPlatform if caller != escrow.platform
pub fn require_platform(env: &Env, escrow: &EscrowState);

// Panics with ContractError::NotMaintainer if caller != escrow.maintainer
pub fn require_maintainer(env: &Env, escrow: &EscrowState);

// Require escrow.is_active == true
pub fn require_active(escrow: &EscrowState);
```

---

## Contract Functions (`lib.rs`)

Implement all 12 functions below. Each spec defines: caller, args, behavior, errors, and what to emit.

---

### 1. `initialize_escrow`

```
Caller:    Admin address (stored at StorageKey::Admin)
Signature: initialize_escrow(
               env: Env,
               repo_id: u64,
               maintainer: Address,
               platform: Address,
               token: Address,
           ) -> BytesN<32>
```

**Behavior:**

- Require `env.invoker() == Admin`
- Derive `escrow_id = env.crypto().sha256(&repo_id.to_xdr(&env))`
- Panic with `EscrowAlreadyExists` if key already in storage
- Store `EscrowState { repo_id, maintainer, platform, token, total_deposited: 0, reserved: 0, total_released: 0, created_at: env.ledger().timestamp(), is_active: true }`
- Store empty `Vec<u64>` at `EscrowIssueIds(escrow_id)`
- Emit `emit_escrow_initialized`
- Return `escrow_id`

**Note:** The backend calls this once per repo after the maintainer connects their repo in the dApp. The returned `escrow_id` is stored in the DB against the repo.

---

### 2. `deposit_funds`

```
Caller:    Maintainer (must sign)
Signature: deposit_funds(env: Env, escrow_id: BytesN<32>, amount: i128)
```

**Behavior:**

- Load escrow, require active
- `require_maintainer`
- `amount > 0` else `ZeroAmount`
- Call `token_client.transfer(maintainer, contract_address, amount)` — pulls USDC from maintainer to contract
- `escrow.total_deposited += amount`
- Save escrow
- Emit `emit_funds_deposited`

---

### 3. `withdraw_funds`

```
Caller:    Maintainer (must sign)
Signature: withdraw_funds(env: Env, escrow_id: BytesN<32>, amount: i128)
```

**Behavior:**

- Load escrow, require active
- `require_maintainer`
- `amount > 0` else `ZeroAmount`
- Compute `available = total_deposited - reserved - total_released`
- Panic `WithdrawExceedsAvailable` if `amount > available`
- Call `token_client.transfer(contract_address, maintainer, amount)`
- `escrow.total_deposited -= amount`
- Save escrow
- Emit `emit_funds_withdrawn`

**This is the only way maintainer gets funds back. It only allows withdrawing funds not locked in any active or pending milestone.**

---

### 4. `create_milestone`

```
Caller:    Platform wallet
Signature: create_milestone(
               env: Env,
               escrow_id: BytesN<32>,
               issue_id: u64,
               title: String,
               reward: i128,
           )
```

**Behavior:**

- Load escrow, require active
- `require_platform`
- Panic `DuplicateIssueId` if `Milestone(escrow_id, issue_id)` already exists
- `reward > 0` else `ZeroAmount`
- Check solvency: `available = total_deposited - reserved - total_released`, panic `InsufficientBalance` if `reward > available`
- Create `Milestone { issue_id, title, reward, contributor: None, status: Pending, created_at: now, released_at: None, actual_released: 0 }`
- `escrow.reserved += reward`
- Push `issue_id` to `EscrowIssueIds(escrow_id)`
- Save both
- Emit `emit_milestone_created`

**Called by the backend webhook handler when `issues.labeled` event fires with a `rewarded` label.**

---

### 5. `assign_contributor`

```
Caller:    Platform wallet
Signature: assign_contributor(
               env: Env,
               escrow_id: BytesN<32>,
               issue_id: u64,
               contributor: Address,
           )
```

**Behavior:**

- Load escrow + milestone
- `require_platform`, require escrow active
- Panic `MilestoneNotPending` if `milestone.status != Pending`
- Set `milestone.contributor = Some(contributor)`
- Set `milestone.status = Active`
- Save milestone
- Emit `emit_contributor_assigned`

**Note:** `reserved` does not change here — it was already incremented at `create_milestone`. Moving from Pending → Active just adds a contributor target.

---

### 6. `release_funds`

```
Caller:    Platform wallet
Signature: release_funds(env: Env, escrow_id: BytesN<32>, issue_id: u64)
```

**Behavior:**

- Load escrow + milestone
- `require_platform`, require escrow active
- Panic `MilestoneNotActive` if `milestone.status != Active`
- Panic `ContributorNotSet` if `milestone.contributor.is_none()`
- Transfer full `milestone.reward` from contract to contributor:
  `token_client.transfer(contract_address, contributor, milestone.reward)`
- `escrow.reserved -= milestone.reward`
- `escrow.total_released += milestone.reward`
- `milestone.status = Released`
- `milestone.released_at = Some(now)`
- `milestone.actual_released = milestone.reward`
- Save both
- Emit `emit_funds_released`

**Called by backend after: `pull_request.closed` webhook + `merged == true` + PR linked to this issue.**

---

### 7. `partial_release`

```
Caller:    Platform wallet (acting on maintainer's instruction from dApp)
Signature: partial_release(
               env: Env,
               escrow_id: BytesN<32>,
               issue_id: u64,
               release_amount: i128,
           )
```

**Behavior:**

- Load escrow + milestone
- `require_platform`, require escrow active
- Panic `MilestoneNotActive` if `milestone.status != Active`
- Panic `ContributorNotSet` if `milestone.contributor.is_none()`
- Panic `ReleaseTooLarge` if `release_amount > milestone.reward`
- `release_amount > 0` else `ZeroAmount`
- Transfer `release_amount` to contributor
- Compute `returned = milestone.reward - release_amount`
- `escrow.reserved -= milestone.reward`
- `escrow.total_released += release_amount`
- NOTE: `returned` goes back into available pool automatically because reserved is decremented by full reward
- `milestone.status = Released`
- `milestone.released_at = Some(now)`
- `milestone.actual_released = release_amount`
- Save both
- Emit `emit_partial_release(escrow_id, issue_id, contributor, release_amount, returned)`

**Design note:** `returned` implicitly re-enters the available pool (available = total_deposited - reserved - total_released). The maintainer sees the corrected balance in `get_balance()` without any explicit "return" transaction needed.

**Production caveat (document in code comments):** In v1, the platform wallet submits this on the maintainer's verbal instruction via the dApp. A production version should require the maintainer to sign this transaction directly to prevent disputes over who authorized the partial amount.

---

### 8. `cancel_milestone`

```
Caller:    Platform wallet
Signature: cancel_milestone(env: Env, escrow_id: BytesN<32>, issue_id: u64)
```

**Behavior:**

- Load escrow + milestone
- `require_platform`, require escrow active
- Panic if `milestone.status == Released` or `milestone.status == Cancelled`
- `escrow.reserved -= milestone.reward`
- `milestone.status = Cancelled`
- Save both
- Emit `emit_milestone_cancelled`

**Called when:**

- Contributor is unassigned on GitHub (`issues.unassigned` webhook)
- PR is closed without merging (`pull_request.closed` + `merged == false`)
- Milestone was Pending (no contributor yet) and issue is deleted/closed

Handles both `Pending → Cancelled` and `Active → Cancelled` transitions.

---

### 9. `get_escrow`

```
Caller:    Anyone (read-only)
Signature: get_escrow(env: Env, escrow_id: BytesN<32>) -> EscrowState
```

Returns `EscrowState`. Panics `EscrowNotFound` if not found.

---

### 10. `get_milestone`

```
Caller:    Anyone (read-only)
Signature: get_milestone(env: Env, escrow_id: BytesN<32>, issue_id: u64) -> Milestone
```

Returns `Milestone`. Panics `MilestoneNotFound` if not found.

---

### 11. `get_balance`

```
Caller:    Anyone (read-only)
Signature: get_balance(env: Env, escrow_id: BytesN<32>) -> BalanceInfo
```

Returns:

```rust
BalanceInfo {
    total_deposited: escrow.total_deposited,
    reserved: escrow.reserved,
    available: escrow.total_deposited - escrow.reserved - escrow.total_released,
    total_released: escrow.total_released,
}
```

---

### 12. `list_milestones`

```
Caller:    Anyone (read-only)
Signature: list_milestones(env: Env, escrow_id: BytesN<32>) -> Vec<Milestone>
```

Reads `EscrowIssueIds(escrow_id)` → iterates each `issue_id` → loads `Milestone` → returns `Vec<Milestone>`.

---

## Critical Implementation Rules

### Stroops conversion

All `i128` amounts are in **stroops**. 1 USDC = 10,000,000 stroops. Never store raw USDC integers.

```rust
// Backend sends: 75 * 10_000_000i128 for 75 USDC
// Never: 75i128
```

### Token transfers use SAC client

```rust
let token = token::Client::new(&env, &escrow.token);
token.transfer(&from, &to, &amount);
```

The contract address is `env.current_contract_address()`.

### `require_auth()` pattern

Any function that moves funds or mutates state must call `address.require_auth()` where address is the expected signer.

```rust
// In require_platform:
escrow.platform.require_auth();

// In deposit_funds (maintainer signs the deposit tx):
escrow.maintainer.require_auth();
```

### available balance invariant

After every state change, verify mentally:

```
available = total_deposited - reserved - total_released >= 0
```

This must never go negative. The `withdraw_funds` and `create_milestone` checks enforce this.

### TTL extension

On every `persistent` storage read or write, extend TTL:

```rust
env.storage().persistent().extend_ttl(&key, 100_000, 100_000);
```

---

## Unit Tests (`test.rs`)

Write tests using `soroban_sdk::testutils`. Cover:

```rust
// Happy path
#[test] fn test_full_bounty_flow()           // deposit → create → assign → release
#[test] fn test_partial_release_correct()    // partial_release returns remainder to pool
#[test] fn test_cancel_returns_to_pool()     // cancel from Active: reserved decremented
#[test] fn test_cancel_pending()             // cancel from Pending works too
#[test] fn test_withdraw_available_only()    // cannot withdraw reserved funds

// Balance invariants
#[test] fn test_available_never_negative()
#[test] fn test_multiple_milestones_balance()

// Auth guards
#[test] fn test_platform_only_create_milestone()   // maintainer cannot call it
#[test] fn test_platform_only_release()
#[test] fn test_maintainer_only_withdraw()

// Error cases
#[test] fn test_insufficient_balance_blocks_milestone()
#[test] fn test_duplicate_issue_id_rejected()
#[test] fn test_release_on_pending_fails()        // must be Active
#[test] fn test_partial_exceeds_reward_fails()
#[test] fn test_cancel_released_fails()
```

---

## Environment Variables (for backend integration)

```bash
SOROBAN_RPC_URL=https://soroban-testnet.stellar.org:443
SOROBAN_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
CONTRACT_ID=<deployed_contract_id>
PLATFORM_SECRET_KEY=S...
PLATFORM_PUBLIC_KEY=G...
USDC_TOKEN_ADDRESS=<testnet_usdc_sac>
```

---

## Build & Deploy Commands

```bash
# Build
stellar contract build

# Run tests
cargo test

# Deploy to testnet
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/trustless_oss.wasm \
  --network testnet \
  --source <deployer_keypair>

# Initialize (set admin = platform wallet)
stellar contract invoke \
  --id <contract_id> \
  --fn initialize_escrow \
  --arg <repo_id> \
  --arg <maintainer_address> \
  --arg <platform_address> \
  --arg <usdc_token_address> \
  --network testnet \
  --source <admin_keypair>
```

---

## Known Limitations to Document in Code Comments

1. **`partial_release` trust gap** — Platform wallet submits on maintainer's verbal instruction. V2: maintainer signs directly.
2. **No milestone timeout** — Funds stay locked if contributor disappears. V2: add `expire_at` field + `force_cancel_expired` function.
3. **Single platform wallet** — Compromise drains all repos. V2: multisig via Soroban auth or per-repo signers.
4. **No dispute arbitration** — V1 maintainer is judge. V2: neutral arbitrator address per escrow.
5. **`initialize_escrow` gated by admin** — Admin key must be secured. V2: open init with maintainer paying XLM deposit.

---

## Implementation Order

1. `types.rs` + `error.rs` — compile-check types first
2. `storage.rs` — helpers before anything uses them
3. `auth.rs` — guards before any function is written
4. `events.rs` — stubs for all emitters
5. `lib.rs` functions in this order:
   - `initialize_escrow`
   - `deposit_funds` + `withdraw_funds`
   - `create_milestone` + `cancel_milestone`
   - `assign_contributor`
   - `release_funds`
   - `partial_release`
   - All 4 query functions
6. `test.rs` — write alongside each function
7. `cargo test` — all tests green before declaring done
