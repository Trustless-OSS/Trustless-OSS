-- ============================================================
-- Trustless OSS — Supabase Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- repos: one row per connected GitHub repo
create table if not exists repos (
  id                  uuid primary key default gen_random_uuid(),
  github_repo_id      bigint unique not null,
  full_name           text not null,
  owner_github_id     bigint not null,
  owner_username      text not null,
  escrow_contract_id  text,
  escrow_balance      numeric default 0,
  reward_low          numeric default 25,
  reward_medium       numeric default 75,
  reward_high         numeric default 150,
  created_at          timestamptz default now()
);

-- contributors: GitHub users who receive bounties
create table if not exists contributors (
  id                uuid primary key default gen_random_uuid(),
  github_user_id    bigint unique not null,
  github_username   text not null,
  stellar_wallet    text,
  created_at        timestamptz default now()
);

-- issues: bounty-enabled GitHub issues
create table if not exists issues (
  id                    uuid primary key default gen_random_uuid(),
  repo_id               uuid references repos(id) on delete cascade,
  github_issue_id       bigint not null,
  github_issue_number   int not null,
  title                 text not null,
  reward_amount         numeric not null,
  difficulty_label      text check (difficulty_label in ('low', 'medium', 'high')),
  bonus_amount          numeric default 0,
  milestone_index       int,
  status                text default 'pending' check (status in ('pending', 'active', 'completed', 'cancelled')),
  created_at            timestamptz default now(),
  unique(repo_id, github_issue_id)
);

-- assignments: which contributor is working on which issue
create table if not exists assignments (
  id              uuid primary key default gen_random_uuid(),
  issue_id        uuid references issues(id) on delete cascade,
  contributor_id  uuid references contributors(id),
  assigned_at     timestamptz default now(),
  pr_number       int,
  pr_merged_at    timestamptz,
  payout_status   text default 'pending' check (payout_status in ('pending', 'released', 'failed')),
  unique(issue_id)
);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

alter table repos         enable row level security;
alter table contributors  enable row level security;
alter table issues        enable row level security;
alter table assignments   enable row level security;

-- Repos: owner can read/write their own repos
create policy "repos_owner" on repos
  for all using (owner_github_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')::bigint);

-- Contributors: users can read/write their own contributor row
create policy "contributors_self" on contributors
  for all using (github_user_id = (auth.jwt() -> 'user_metadata' ->> 'provider_id')::bigint);

-- Issues: anyone authenticated can read; backend service role writes
create policy "issues_read" on issues
  for select using (auth.role() = 'authenticated');

-- Assignments: anyone authenticated can read
create policy "assignments_read" on assignments
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- Indexes for performance
-- ============================================================

create index if not exists idx_repos_github_id       on repos(github_repo_id);
create index if not exists idx_issues_repo            on issues(repo_id);
create index if not exists idx_issues_github_id       on issues(github_issue_id);
create index if not exists idx_assignments_issue      on assignments(issue_id);
create index if not exists idx_contributors_github_id on contributors(github_user_id);
