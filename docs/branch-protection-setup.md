# Branch Protection Setup Guide

After pushing all the CI files, configure these settings in your GitHub repository.

Go to: **Settings → Branches → Add branch protection rule**

---

## Rule 1: Protect `main`

**Branch name pattern:** `main`

### Required status checks

Enable **"Require status checks to pass before merging"** and add:

| Check name | From workflow |
|---|---|
| `Lint & Type Check` | ci-backend.yml |
| `Build` | ci-backend.yml |
| `Tests` | ci-backend.yml |
| `Lint & Type Check` | ci-frontend.yml |
| `Build` | ci-frontend.yml |
| `All Checks Passed` | pr-checks.yml |

Also enable **"Require branches to be up to date before merging"**.

### Other settings to enable

| Setting | Value | Reason |
|---|---|---|
| Require a pull request before merging | ✅ ON | No direct pushes |
| Required approvals | **1** (or 2 for sensitive branches) | Human review |
| Dismiss stale reviews when new commits pushed | ✅ ON | Re-review on changes |
| Require review from Code Owners | ✅ ON (if CODEOWNERS exists) | Expert review |
| Restrict who can push | ✅ ON — only maintainers | Lock down |
| Allow force pushes | ❌ OFF | Protect history |
| Allow deletions | ❌ OFF | Can't delete main |
| Require signed commits | ✅ ON (recommended) | Verify identity |
| Require linear history | ✅ ON (recommended) | Clean git log |

---

## Rule 2: Protect `develop`

**Branch name pattern:** `develop`

Same as `main` but:
- Required approvals: **1**
- Require linear history: Optional

---

## Rule 3: Restrict contributor branches (optional)

**Branch name pattern:** `feat/*` `fix/*` `docs/*`

- Require status checks: ✅ ON
- Require PR before merge: ❌ OFF (contributors can push to their own branches)

---

## CODEOWNERS file

Create `.github/CODEOWNERS` to require maintainer review on sensitive files:

```
# Default owners for everything
* @your-github-username

# Backend security-critical files — require explicit review
backend/src/routes/webhooks.ts @your-github-username
backend/src/lib/auth.ts @your-github-username
backend/src/lib/trustless-work/ @your-github-username
backend/src/lib/stellar/ @your-github-username
docs/schema.sql @your-github-username

# CI config — maintainer-only
.github/ @your-github-username
```

---

## Verifying the setup

After configuration, test it by:

1. Creating a branch: `git checkout -b test/branch-protection`
2. Making a small change and pushing
3. Opening a PR — you should see all status checks listed as "pending"
4. Trying to merge before CI passes — the "Merge" button should be greyed out
5. Letting CI pass — the "Merge" button should appear only after approval

If you can still merge without checks, re-check that the check names in the
protection rules **exactly match** the `name:` field in the workflow job.
