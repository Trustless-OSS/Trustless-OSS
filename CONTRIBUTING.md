# Contributing to Trustless OSS

Thanks for your interest in contributing! This guide covers everything you need
to get your code accepted and your bounty paid.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Branching Strategy](#branching-strategy)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)
- [Code Quality Gates](#code-quality-gates)
- [Local Development Setup](#local-development-setup)
- [Running Tests](#running-tests)

---

## Getting Started

1. **Fork** the repository and clone your fork
2. Install dependencies: `pnpm install` (from the root)
3. Copy environment file:
   ```bash
   cp .env.example .env
   ```
4. Fill in environment variables (see README for details)
5. Create a branch for your work (see [Branching Strategy](#branching-strategy))

---

## Branching Strategy

We use a simple two-branch model:

| Branch    | Purpose                                               |
| --------- | ----------------------------------------------------- |
| `main`    | Production-ready code. **Direct pushes are blocked.** |
| `develop` | Integration branch. All PRs target here first.        |

**Your working branches** should follow this naming convention:

```
feat/short-description        # New features
fix/short-description         # Bug fixes
docs/short-description        # Documentation only
refactor/short-description    # Code restructuring, no feature change
chore/short-description       # Maintenance tasks
```

**Examples:**

```
feat/contributor-wallet-connect
fix/webhook-signature-null-body
docs/update-deployment-guide
```

---

## Commit Messages

We enforce [Conventional Commits](https://www.conventionalcommits.org/).
The format is:

```
type(optional-scope): short description

Optional longer body explaining WHY, not what.

Optional footer: Closes #42
```

**Valid types:**

| Type       | When to use                             |
| ---------- | --------------------------------------- |
| `feat`     | A new feature                           |
| `fix`      | A bug fix                               |
| `docs`     | Documentation changes only              |
| `style`    | Formatting, no logic change             |
| `refactor` | Code restructure, no new feature or fix |
| `perf`     | Performance improvement                 |
| `test`     | Adding or fixing tests                  |
| `build`    | Build system or dependency changes      |
| `ci`       | CI/CD config changes                    |
| `chore`    | Misc maintenance                        |
| `revert`   | Reverting a commit                      |

**Examples:**

```bash
git commit -m "feat: add @Trustless-OSS /change-address command"
git commit -m "fix(webhook): handle null PR body in extractIssueNumber"
git commit -m "test: add unit tests for HMAC signature verification"
```

The commit-msg hook will reject messages that don't match this format.

---

## Pull Request Process

1. **Open a PR against `develop`**, not `main`
2. **Fill out the PR template** — a description under 20 characters will be rejected
3. **Link the issue** your PR closes: add `Closes #N` in the description
4. **Ensure all CI checks pass** before requesting review:
   - ✅ TypeScript type check
   - ✅ ESLint (zero warnings)
   - ✅ Prettier format check
   - ✅ All unit tests pass
   - ✅ Build succeeds
5. **Request a review** from a maintainer
6. **Do not merge your own PR** — wait for maintainer approval

### What will get your PR rejected

- Code that doesn't pass CI
- No tests for new logic (especially webhook handlers and API routes)
- Hardcoded secrets or credentials (even test values)
- `console.log` left in production code paths
- Any `// @ts-ignore` or `as any` without a comment explaining why
- Skipping the PR description

---

## Code Quality Gates

These run automatically on every PR and push. You can also run them locally.

### Backend

```bash
pnpm --filter @trustless-oss/backend typecheck    # Type check only
pnpm --filter @trustless-oss/backend lint          # Lint only
pnpm --filter @trustless-oss/backend format:check  # Format check only
```

### Frontend

```bash
pnpm --filter @trustless-oss/frontend typecheck    # Type check
pnpm --filter @trustless-oss/frontend lint          # Lint
pnpm --filter @trustless-oss/frontend build         # Build check
```

### All at once (from root)

```bash
pnpm validate       # Run typecheck + lint + format check across all apps
pnpm lint           # Lint all apps
pnpm typecheck      # Type check all apps
pnpm build          # Build all apps
pnpm format         # Auto-format all code
```

---

## Local Development Setup

### Prerequisites

- Node.js ≥ 20
- A [Supabase](https://supabase.com) project with `docs/schema.sql` applied
- A GitHub App (see README for setup steps)
- A Stellar testnet wallet with USDC trustline

### Starting the servers

```bash
# Terminal 1 — backend
pnpm dev:backend

# Terminal 2 — frontend
pnpm dev:frontend

# Terminal 3 — webhook proxy (forwards GitHub → localhost)
pnpm --filter @trustless-oss/backend proxy
```

### Running the database migration

```bash
pnpm --filter @trustless-oss/backend migrate
```

---

## Running Tests

```bash
# All tests
npm test

# Tests with coverage report
npm run test:coverage

# Watch mode (re-runs on file change)
npm run test:watch
```

The coverage report is generated in `backend/coverage/`. Open
`backend/coverage/index.html` in a browser to explore it.

**Coverage requirements** (enforced in CI):

- Lines: 70%
- Functions: 70%
- Branches: 60%

New code should include tests. Priority areas:

- Webhook event handlers
- Label parsing logic
- Milestone push/release flows
- API auth/authorization checks

---

## Questions?

Open a GitHub Discussion or comment on the relevant issue.
Do not DM maintainers directly for support questions.
