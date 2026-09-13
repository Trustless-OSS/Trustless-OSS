import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { SiGithub } from 'react-icons/si';
import { createClient } from '@/lib/supabase/server';
import DeployEscrowButton from '@/app/components/escrow/DeployEscrowButton';
import FundEscrowButton from '@/app/components/escrow/FundEscrowButton';
import RewardSettingsForm from '@/app/components/escrow/RewardSettingsForm';
import RetryProcessButton from '@/app/components/escrow/RetryProcessButton';
import RefundFundButton from '@/app/components/escrow/RefundFundButton';
import DeleteRepoButton from '@/app/components/dashboard/DeleteRepoButton';
import Button from '@/app/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getActorUsername } from '@/lib/issues';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

type Repo = {
  id: string;
  github_repo_id: number;
  full_name: string;
  owner_github_id: number;
  owner_username: string;
  installer_github_id: number | null;
  github_installation_id: number | null;
  escrow_contract_id: string | null;
  escrow_funder_wallet?: string | null;
  escrow_balance: number;
  reward_low: number;
  reward_medium: number;
  reward_high: number;
  is_fork: boolean;
  is_private: boolean;
  owner_type: 'User' | 'Organization';
  created_at: string;
};

function toNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalizeRepo(data: unknown): Repo | null {
  if (!data || typeof data !== 'object') return null;

  const repo = data as Repo;
  return {
    ...repo,
    escrow_balance: toNumber(repo.escrow_balance),
    reward_low: toNumber(repo.reward_low),
    reward_medium: toNumber(repo.reward_medium),
    reward_high: toNumber(repo.reward_high),
  };
}

function repoDisplayName(fullName: string): string {
  const name = fullName.split('/').pop()?.trim();
  return name || fullName;
}

async function getRepo(repoId: string, token: string): Promise<Repo | null> {
  try {
    const res = await fetch(`${BACKEND}/api/repos/${repoId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const data = await res.json();
    return normalizeRepo(data.data ?? data.repo ?? null);
  } catch {
    return null;
  }
}

async function getIssues(repoId: string, token: string) {
  try {
    const res = await fetch(`${BACKEND}/api/repos/${repoId}/issues`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const data = await res.json();
    return data.data ?? data.issues ?? [];
  } catch {
    return [];
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'status-pending',
    active: 'status-active',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
  };
  return `${map[status] ?? 'status-pending'} status-badge`;
}

function diffBadge(diff: string | null) {
  if (!diff) return '';
  const map: Record<string, string> = {
    low: 'diff-low',
    medium: 'diff-medium',
    high: 'diff-high',
    custom: 'diff-custom',
  };
  return `${map[diff] ?? ''} rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide`;
}

export default async function RepoDetailPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token ?? '';
  const [repo, issues] = await Promise.all([getRepo(repoId, token), getIssues(repoId, token)]);

  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  const isRepoMaintainer =
    repo &&
    (Number(repo.owner_github_id) === githubId || Number(repo.installer_github_id) === githubId);

  return (
    <div className="w-full space-y-10">
      {repo && (
        <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                {repoDisplayName(repo.full_name)}
              </h1>
              <Button
                href={`https://github.com/${repo.full_name}`}
                external
                variant="outline"
                size="sm"
                aria-label={`Open ${repo.full_name} on GitHub`}
                className="h-7 gap-1.5 rounded-md border-border bg-card px-2.5 text-xs font-semibold text-foreground shadow-sm hover:bg-muted"
              >
                <SiGithub className="size-3.5 text-muted-foreground" aria-hidden="true" />
                GitHub
                <ExternalLink
                  size={12}
                  strokeWidth={2.25}
                  className="text-muted-foreground"
                  aria-hidden="true"
                />
              </Button>
            </div>
            {repo.escrow_contract_id ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="font-mono font-semibold">
                  {repo.escrow_contract_id.slice(0, 8)}…{repo.escrow_contract_id.slice(-6)}
                </span>
                <Button
                  href={`https://viewer.trustlesswork.com/${repo.escrow_contract_id}`}
                  external
                  variant="ghost"
                  size="sm"
                  className="h-auto gap-1.5 px-2 py-1 text-blue-600"
                >
                  <ExternalLink size={14} strokeWidth={2.5} aria-hidden="true" />
                  Inspect
                </Button>
              </div>
            ) : (
              <div className="mt-4 max-w-xs space-y-3">
                <p className="text-sm font-semibold text-red-600">No escrow contract yet</p>
                <DeployEscrowButton repoId={repoId} token={session?.access_token ?? ''} />
              </div>
            )}
          </div>

          {repo.escrow_contract_id && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
              <div className="sm:pr-2">
                <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Balance
                </p>
                <p className="text-2xl font-black tracking-tight text-foreground">
                  {repo.escrow_balance.toFixed(2)}{' '}
                  <span className="text-sm font-semibold text-muted-foreground">USDC</span>
                </p>
              </div>
              {isRepoMaintainer && (
                <div className="flex flex-wrap items-center gap-2">
                  <FundEscrowButton
                    repoId={repoId}
                    token={session?.access_token ?? ''}
                    repoName={repo.full_name}
                    currentBalance={repo.escrow_balance}
                  />
                  {repo.escrow_balance > 0 ? (
                    <RefundFundButton
                      repoId={repoId}
                      token={session?.access_token ?? ''}
                      currentBalance={repo.escrow_balance}
                      destinationAddress={repo.escrow_funder_wallet}
                    />
                  ) : (
                    <DeleteRepoButton repoId={repoId} token={session?.access_token ?? ''} />
                  )}
                </div>
              )}
            </div>
          )}
        </header>
      )}

      {isRepoMaintainer && repo && (
        <RewardSettingsForm
          repoId={repoId}
          token={session?.access_token ?? ''}
          initialLow={repo.reward_low}
          initialMedium={repo.reward_medium}
          initialHigh={repo.reward_high}
        />
      )}

      {!isRepoMaintainer && repo && (
        <p className="text-sm font-semibold text-muted-foreground">
          You are viewing this repository as a contributor.
        </p>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="text-xl font-black tracking-tight text-foreground">Active bounties</h2>
          <p className="text-sm font-semibold text-muted-foreground">{issues.length} tracked</p>
        </div>

        {issues.length === 0 ? (
          <div className="rounded-2xl bg-card/80 px-6 py-12 text-center ring-1 ring-foreground/10">
            <p className="text-sm font-semibold text-muted-foreground">No tracked issues yet.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Add a <span className="font-semibold text-foreground">rewarded</span> label with{' '}
              <span className="font-semibold text-foreground">low</span>,{' '}
              <span className="font-semibold text-foreground">medium</span>, or{' '}
              <span className="font-semibold text-foreground">high</span>, or comment{' '}
              <span className="font-semibold text-foreground">@Trustless-OSS 50</span> on an issue.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card/80 ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow className="text-left text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  <TableHead className="px-5">Target</TableHead>
                  <TableHead className="px-5">Class</TableHead>
                  <TableHead className="px-5">Bounty</TableHead>
                  <TableHead className="px-5">State</TableHead>
                  <TableHead className="px-5">Actor</TableHead>
                  <TableHead className="px-5">Exec</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {issues.map(
                  (issue: {
                    id: string;
                    github_issue_number: number;
                    title: string;
                    difficulty_label: string | null;
                    reward_amount: number;
                    status: string;
                    assignments?: unknown;
                  }) => {
                    const assignment = Array.isArray(issue.assignments)
                      ? issue.assignments[0]
                      : issue.assignments;
                    const actorUsername = getActorUsername(issue);
                    return (
                      <TableRow key={issue.id} className="text-foreground">
                        <TableCell className="px-5 py-3.5">
                          <span className="mr-2 font-bold text-primary">
                            #{issue.github_issue_number}
                          </span>
                          <span className="font-semibold">{issue.title}</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5">
                          {issue.difficulty_label && (
                            <span className={diffBadge(issue.difficulty_label)}>
                              {issue.difficulty_label}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-3.5 font-mono">
                          <span className="font-black">{issue.reward_amount}</span>{' '}
                          <span className="text-xs font-semibold text-muted-foreground">USDC</span>
                        </TableCell>
                        <TableCell className="px-5 py-3.5">
                          <Badge variant="secondary" className={statusBadge(issue.status)}>
                            {issue.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-5 py-3.5">
                          {actorUsername ? (
                            <a
                              href={`https://github.com/${actorUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                            >
                              @{actorUsername}
                            </a>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-5 py-3.5">
                          {isRepoMaintainer ? (
                            <RetryProcessButton
                              issueId={issue.id}
                              token={session?.access_token ?? ''}
                              status={issue.status}
                              payoutStatus={
                                assignment &&
                                typeof assignment === 'object' &&
                                'payout_status' in assignment
                                  ? String(
                                      (assignment as { payout_status?: string }).payout_status ??
                                        'pending'
                                    )
                                  : 'pending'
                              }
                            />
                          ) : (
                            <span className="text-xs font-semibold text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  }
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
