# Database Migrations

Versioned database schema and migration files for Supabase/PostgreSQL.

## Files

- `001_initial_schema.sql` — Initial database schema (tables, RLS, indexes)

## Setup

### Option 1: Using Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy and paste contents of `001_initial_schema.sql`
5. Click **Run**

### Option 2: Using CLI

```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Link to your project
supabase link --project-ref <project-id>

# Run migration
supabase db push

# Or manually with psql
psql postgresql://user:password@host:port/database < 001_initial_schema.sql
```

### Option 3: Programmatically

Use the `src/migrate.ts` script in the backend:

```bash
pnpm migrate
```

This reads `001_initial_schema.sql` and applies it to the connected database.

## Naming Convention

Migrations are versioned with leading numbers:

```
001_initial_schema.sql
002_add_custom_bounty.sql
003_add_dispute_resolution.sql
...
```

## Schema Overview

### Tables

| Table          | Purpose                                        |
| -------------- | ---------------------------------------------- |
| `repos`        | Connected GitHub repositories with escrow info |
| `contributors` | GitHub users who receive bounties              |
| `issues`       | Bounty-enabled GitHub issues                   |
| `assignments`  | Contributor assignments to issues              |

### Security

- Row-level security (RLS) enabled on all tables
- Policies restrict access by GitHub user ID
- Backend uses service role key for admin operations

### Indexes

Performance indexes on:

- `repos.github_repo_id`
- `issues.repo_id`, `issues.github_issue_id`
- `assignments.issue_id`
- `contributors.github_user_id`

## Adding New Migrations

When adding schema changes:

1. Create new file: `00X_description.sql`
2. Write SQL changes (use `IF NOT EXISTS` for safety)
3. Test locally with Supabase Docker or sandbox
4. Document changes in this README
5. Commit and push

Example:

```sql
-- 002_add_custom_bounty.sql
ALTER TABLE issues ADD COLUMN IF NOT EXISTS custom_amount numeric;
CREATE INDEX IF NOT EXISTS idx_issues_custom ON issues(custom_amount);
```

## Rollback

Migrations are designed to be idempotent (safe to re-run). If you need to rollback:

1. Don't delete migrations
2. Create new `00X_rollback_Y.sql` file
3. Document the rollback reason

Example rollback strategy (preferred):

```sql
-- 003_rollback_custom_bounty.sql
-- Removed custom_amount logic in favor of reward_amount
ALTER TABLE issues DROP COLUMN IF EXISTS custom_amount;
```

## Verifying Schema

After running migrations, verify in Supabase:

```bash
# List tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

# Check indexes
SELECT * FROM pg_indexes
WHERE schemaname = 'public';

# Check RLS policies
SELECT * FROM pg_policies;
```
