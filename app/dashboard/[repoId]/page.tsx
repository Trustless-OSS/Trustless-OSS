import { redirect } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { SiGithub } from 'react-icons/si';
import { createClient } from '@/lib/supabase/server';
import DeployEscrowButton from '@/app/components/escrow/DeployEscrowButton';
import FundEscrowButton from '@/app/components/escrow/FundEscrowButton';
import RetryProcessButton from '@/app/components/escrow/RetryProcessButton';
import RefundFundButton from '@/app/components/escrow/RefundFundButton';
import RewardSettingsForm from '@/app/components/escrow/RewardSettingsForm';
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

// CREATE TABLE "repositories"(
//   "id" UUID NOT NULL,
//   "github_repo_id" BIGINT NOT NULL,
//   "github_install_id" BIGINT,
//   "full_name" TEXT NOT NULL,
//   "escrow_contract_id" TEXT,
//   "escrow_balance" NUMERIC,
//   "balance_synced_at" TIMESTAMPTZ(6),
//   "created_at" TIMESTAMPTZ(6) NOT NULL,
//   PRIMARY KEY("id")
// );
// pub(crate) struct RepoDetails {
//   pub(crate) repo: Repo,
//     pub(crate) is_maintainer: bool,
//       pub(crate) escrow_deployed: bool,
//         pub(crate) escrow_status: & 'static str,
//   pub(crate) can_deploy_escrow: bool,
//     pub(crate) can_fund_escrow: bool,
//       pub(crate) can_close_escrow: bool,
//         pub(crate) can_refund_escrow: bool,
// }

type Repo = {
  id: string;
  github_repo_id: number;
  github_install_id: number | null;
  full_name: string;
  escrow_contract_id: string | null;
  escrow_funder_wallet?: string | null;
  escrow_balance: number;
  balance_synced_at: string | null;
  created_at: string;
  rewards?: RewardLevel[];
};

type RepoDetails = {
  repo: Repo;
  is_maintainer: boolean;
  escrow_deployed: boolean;
  escrow_status: string;
  can_deploy_escrow: boolean;
  can_fund_escrow: boolean;
  can_close_escrow: boolean;
  can_refund_escrow: boolean;
};

type RewardLevel = {
  label: string;
  amount: number;
};

type Reward = RewardLevel[];

type JsonRecord = Record<string, unknown>;

function toNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function boolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeRewardLevels(value: unknown): RewardLevel[] {
  if (!value) return [];

  const nestedValue =
    isRecord(value) &&
    (value.rewards ?? value.reward_levels ?? value.rewardLevels ?? value.levels ?? value.tiers)
      ? (value.rewards ?? value.reward_levels ?? value.rewardLevels ?? value.levels ?? value.tiers)
      : value;

  if (Array.isArray(nestedValue)) {
    return nestedValue.flatMap((item) => {
      if (isRecord(item)) {
        const label =
          nullableString(item.label) ??
          nullableString(item.name) ??
          nullableString(item.reward_label) ??
          nullableString(item.level) ??
          null;
        const amount = toNumber(
          item.amount ??
            item.value ??
            item.usdc ??
            item.reward_amount ??
            item.reward ??
            item.amount_usdc
        );

        return label && Number.isFinite(amount) ? [{ label, amount }] : [];
      }

      if (typeof item === 'number' || typeof item === 'string') {
        const amount = toNumber(item);
        return Number.isFinite(amount) ? [{ label: 'custom', amount }] : [];
      }

      return [];
    });
  }

  if (isRecord(nestedValue)) {
    return Object.entries(nestedValue).flatMap(([key, raw]) => {
      if (isRecord(raw)) {
        const label =
          nullableString(raw.label) ??
          nullableString(raw.name) ??
          nullableString(raw.reward_label) ??
          nullableString(raw.level) ??
          key;
        const amount = toNumber(
          raw.amount ?? raw.value ?? raw.usdc ?? raw.reward_amount ?? raw.reward ?? raw.amount_usdc
        );

        if (!label || !Number.isFinite(amount)) return [];
        return [{ label, amount }];
      }

      if (typeof raw === 'number' || typeof raw === 'string') {
        const amount = toNumber(raw);
        if (!Number.isFinite(amount)) return [];
        return [{ label: key, amount }];
      }

      return [];
    });
  }

  return [];
}

function normalizeRepo(data: unknown): RepoDetails | null {
  if (!isRecord(data)) return null;

  const source = isRecord(data.repo) ? data.repo : isRecord(data.Repo) ? data.Repo : data;
  const id = nullableString(source.id);
  const fullName = nullableString(source.full_name);
  const createdAt = nullableString(source.created_at);
  if (!id || !fullName || !createdAt) return null;

  const rewardLevels = normalizeRewardLevels(
    source.rewards ??
      source.reward_levels ??
      source.rewardLevels ??
      source.levels ??
      source.tiers ??
      data.rewards ??
      data.reward_levels ??
      data.rewardLevels ??
      data.levels ??
      data.tiers
  );

  const escrowContractId = nullableString(source.escrow_contract_id);
  const escrowDeployed = boolean(
    data.escrow_deployed ?? data.escrowDeployed,
    Boolean(escrowContractId)
  );
  const repo: Repo = {
    id,
    github_repo_id: toNumber(source.github_repo_id),
    github_install_id:
      source.github_install_id === null || source.github_install_id === undefined
        ? null
        : toNumber(source.github_install_id),
    full_name: fullName,
    escrow_contract_id: escrowContractId,
    escrow_funder_wallet: nullableString(source.escrow_funder_wallet),
    escrow_balance: toNumber(source.escrow_balance),
    balance_synced_at: nullableString(source.balance_synced_at),
    created_at: createdAt,
    rewards: rewardLevels,
  };

  return {
    repo,
    is_maintainer: boolean(data.is_maintainer ?? data.isMaintainer),
    escrow_deployed: escrowDeployed,
    escrow_status:
      nullableString(data.escrow_status ?? data.escrowStatus) ??
      (escrowDeployed ? 'active' : 'not_deployed'),
    can_deploy_escrow: boolean(data.can_deploy_escrow ?? data.canDeployEscrow),
    can_fund_escrow: boolean(data.can_fund_escrow ?? data.canFundEscrow),
    can_close_escrow: boolean(data.can_close_escrow ?? data.canCloseEscrow),
    can_refund_escrow: boolean(data.can_refund_escrow ?? data.canRefundEscrow),
  };
}

function repoDisplayName(fullName: string): string {
  const name = fullName.split('/').pop()?.trim();
  return name || fullName;
}

async function getRepo(repoId: string, token: string): Promise<RepoDetails | null> {
  try {
    const res = await fetch(`${BACKEND}/api/v1/repos/${repoId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const data = await res.json();
    return normalizeRepo(data.data ?? data);
  } catch {
    return null;
  }
}

async function getRepoRewards(repoId: string, token: string): Promise<Reward | null> {
  try {
    const res = await fetch(`${BACKEND}/api/v1/repos/rewards/${repoId}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;

    const data = await res.json();
    const rewardLevels = normalizeRewardLevels(data.data ?? data);
    return rewardLevels.length > 0 ? rewardLevels : null;
  } catch {
    return null;
  }
}

async function getIssues(repoId: string, token: string) {
  try {
    const res = await fetch(`${BACKEND}/api/v1/repos/${repoId}/issues`, {
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
  const normalized = diff.trim().toLowerCase();
  const map: Record<string, string> = {
    low: 'diff-low',
    medium: 'diff-medium',
    high: 'diff-high',
    custom: 'diff-custom',
  };
  return `${map[normalized] ?? 'diff-custom'} rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide`;
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
  const [repoDetails, issues, repoRewards] = await Promise.all([
    getRepo(repoId, token),
    getIssues(repoId, token),
    getRepoRewards(repoId, token),
  ]);
  const repo = repoDetails?.repo;
  const rewardLevels = repo?.rewards?.length ? repo.rewards : (repoRewards ?? []);
  const hasEscrow = Boolean(repoDetails?.escrow_deployed && repo?.escrow_contract_id);
  const isRepoMaintainer = repoDetails?.is_maintainer ?? false;

  return (
    <div className="w-full space-y-10">
      {repo && (
        <header className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
                {repoDisplayName(repo.full_name)}
              </h1>
            </div>
            {hasEscrow && repo.escrow_contract_id ? (
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
            ) : (
              <div className="mt-4 max-w-xs space-y-3">
                <p className="text-sm font-semibold text-red-600">No escrow contract yet</p>
                {repoDetails?.can_deploy_escrow && (
                  <DeployEscrowButton repoId={repoId} token={session?.access_token ?? ''} />
                )}
              </div>
            )}
          </div>

          {hasEscrow && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:justify-end">
              <div className="sm:pr-2">
                <p className="text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                  Balance
                </p>
                <p className="text-2xl font-black tracking-tight text-foreground">
                  {repo.escrow_balance.toFixed(2)}{' '}
                  <span className="text-sm  font-semibold text-muted-foreground">USDC</span>
                </p>
              </div>
              {(repoDetails?.can_fund_escrow ||
                repoDetails?.can_refund_escrow ||
                isRepoMaintainer) && (
                <div className="flex flex-wrap items-center gap-2">
                  {repoDetails?.can_fund_escrow && (
                    <FundEscrowButton
                      repoId={repoId}
                      token={session?.access_token ?? ''}
                      repoName={repo.full_name}
                      currentBalance={repo.escrow_balance}
                    />
                  )}
                  {repo.escrow_balance > 0 && repoDetails?.can_refund_escrow ? (
                    <RefundFundButton
                      repoId={repoId}
                      token={session?.access_token ?? ''}
                      currentBalance={repo.escrow_balance}
                      destinationAddress={repo.escrow_funder_wallet}
                    />
                  ) : repo.escrow_balance === 0 && isRepoMaintainer ? (
                    <DeleteRepoButton repoId={repoId} token={session?.access_token ?? ''} />
                  ) : null}
                </div>
              )}
            </div>
          )}
        </header>
      )}

      {!isRepoMaintainer && repo && (
        <p className="text-sm font-semibold text-muted-foreground">
          You are viewing this repository as a contributor.
        </p>
      )}

      {rewardLevels.length > 0 && (
        <RewardSettingsForm repoId={repoId} token={token} initialLevels={rewardLevels} />
      )}

      {rewardLevels.length === 0 && isRepoMaintainer && (
        <RewardSettingsForm repoId={repoId} token={token} initialLevels={[]} />
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
              {rewardLevels.length > 0 ? (
                rewardLevels.map((level, index) => (
                  <span key={`${level.label}-${index}`} className="font-semibold text-foreground">
                    {level.label}
                    {index < rewardLevels.length - 1 ? ', ' : ''}
                  </span>
                ))
              ) : (
                <>
                  <span className="font-semibold text-foreground">low</span>,{' '}
                  <span className="font-semibold text-foreground">medium</span>, or{' '}
                  <span className="font-semibold text-foreground">high</span>
                </>
              )}
              , or comment <span className="font-semibold text-foreground">@toss /50</span> on an
              issue.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-card/80 ring-1 ring-foreground/10">
            <Table>
              <TableHeader>
                <TableRow className="text-left text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  <TableHead className="px-5">Issue</TableHead>
                  <TableHead className="px-5">Level</TableHead>
                  <TableHead className="px-5">Amount</TableHead>
                  <TableHead className="px-5">State</TableHead>
                  <TableHead className="px-5">Assiged</TableHead>
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
