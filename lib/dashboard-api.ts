import { authHeaders, backendUrl, remoteBackendUrl } from '@/lib/backend';
import type { StellarNetwork } from '@/lib/network';
import { createClient } from '@/lib/supabase/client';
import {
  githubAvatarUrl,
  type ActivityRow,
  type LeaderboardEntry,
  type RepoChartPoint,
} from '@/app/components/dashboard/activity';

// Amounts arrive as decimal strings or numbers and are normalized for chart components.

export type FundsMovementPoint = {
  month: string;
  period: string;
  tvl: number;
  payouts: number;
};

export type LeaderboardPage = {
  items: LeaderboardEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// Backend amount: decimal string, or null for a genuinely absent amount.
function amount(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function responseRows(value: unknown, message: string): Record<string, unknown>[] {
  const rows = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && 'data' in value
      ? value.data
      : null;
  if (
    !Array.isArray(rows) ||
    rows.some((row) => !row || typeof row !== 'object' || Array.isArray(row))
  ) {
    throw new Error(message);
  }
  return rows as Record<string, unknown>[];
}

function requiredAmount(value: unknown, field: string): number {
  const parsed = amount(value);
  if (parsed === null) throw new Error(`Invalid ${field} in dashboard response.`);
  return parsed;
}

function currentPeriod(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

async function fetchRepos(): Promise<Record<string, unknown>[]> {
  return responseRows(
    await getAuthed<unknown>('/repos'),
    'Unexpected repositories response from the server.'
  );
}

function deployedBalance(repos: Record<string, unknown>[]) {
  return repos.reduce((total, repo) => {
    const contractId = repo.escrow_contract_id ?? repo.escrowContractId;
    if (typeof contractId !== 'string' || !contractId.trim()) return total;
    return total + (amount(repo.escrow_balance ?? repo.escrowBalance) ?? 0);
  }, 0);
}

export function completeFundsMovementSeries(
  points: FundsMovementPoint[],
  liveBalance: number,
  now = new Date()
): FundsMovementPoint[] {
  const pointsByPeriod = new Map(points.map((point) => [point.period, point]));
  const activePeriod = currentPeriod(now);

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const period = currentPeriod(date);
    const existing = pointsByPeriod.get(period);
    return {
      month: existing?.month ?? new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date),
      period,
      tvl: period === activePeriod ? liveBalance : (existing?.tvl ?? 0),
      payouts: existing?.payouts ?? 0,
    };
  });
}

async function browserToken(): Promise<string> {
  const {
    data: { session },
  } = await createClient().auth.getSession();
  return session?.access_token ?? '';
}

async function getAuthed<T>(path: string): Promise<T> {
  const token = await browserToken();
  const res = await fetch(backendUrl(path), {
    headers: authHeaders(token, false),
    cache: 'no-store',
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  // A 2xx carrying an { error } body (or any non-list where a list is expected) is a
  // backend fault, not an empty feed — surface it instead of rendering a blank state.
  if (body && typeof body === 'object' && 'error' in body) {
    throw new Error(String((body as { error: unknown }).error));
  }
  return body as T;
}

export async function fetchActivity(): Promise<ActivityRow[]> {
  const rows = responseRows(
    await getAuthed<unknown>('/dashboard/activity'),
    'Unexpected activity response from the server.'
  );
  return rows.map((r) => ({
    id: String(r.id),
    at: String(r.at),
    repo: String(r.repo),
    issueNumber: (r.issueNumber as number | null) ?? (r.issue_number as number | null) ?? null,
    issueTitle: (r.issueTitle as string | null) ?? (r.issue_title as string | null) ?? null,
    kind: (r.kind || r.type) as ActivityRow['kind'],
    amountUsdc: amount(r.amountUsdc ?? r.amount_usdc),
    contributor: (r.contributor as string | null) ?? (r.user as string | null) ?? null,
    // Try camelCase first, then snake_case
    txHash: (r.txHash as string | null) ?? (r.tx_hash as string | null) ?? null,
  }));
}

export async function fetchDeployedEscrowBalance(): Promise<number> {
  return deployedBalance(await fetchRepos());
}

export async function fetchFundsMovement(): Promise<FundsMovementPoint[]> {
  const [response, repos] = await Promise.all([
    getAuthed<unknown>('/dashboard/funds-movement?months=12'),
    fetchRepos(),
  ]);
  const points = responseRows(response, 'Unexpected funds-movement response from the server.');
  const pointsByPeriod = new Map<string, FundsMovementPoint>();
  
  for (const point of points) {
  
    const period = (point.period as string | null) ?? (point.month as string | null);

    if (typeof period !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) {
      continue;
    }
    
    const date = new Date(`${period}-01T00:00:00Z`);
    pointsByPeriod.set(period, {
      month:
        typeof point.label === 'string'
          ? point.label
          : new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date),
      period,
      tvl: requiredAmount(point.tvl, 'tvl'),
      payouts: requiredAmount(point.payouts, 'payouts'),
    });
  }

  return completeFundsMovementSeries([...pointsByPeriod.values()], deployedBalance(repos));
}

export async function fetchDashboardRepos(): Promise<RepoChartPoint[]> {
  const repos = await fetchRepos();
  return repos.map((repo) => {
    const fullName = repo.full_name ?? repo.fullName;
    if (typeof fullName !== 'string' || !fullName) {
      throw new Error('Invalid repository name in repositories response.');
    }
    const contractId = repo.escrow_contract_id ?? repo.escrowContractId;
    const balance =
      typeof contractId === 'string' && contractId.trim()
        ? requiredAmount(repo.escrow_balance ?? repo.escrowBalance, 'repository escrow balance')
        : 0;
    const locked = amount(repo.locked) ?? balance;
    const released = amount(repo.released) ?? 0;
    return {
      name: typeof repo.name === 'string' ? repo.name : (fullName.split('/').at(-1) ?? fullName),
      repo: fullName,
      locked,
      released,
      remaining: amount(repo.remaining) ?? Math.max(0, locked - released),
      rewarded: amount(repo.rewarded ?? repo.issues_rewarded) ?? 0,
    };
  });
}

function toEntries(items: Record<string, unknown>[]): LeaderboardEntry[] {
  return items.map((i) => {
    const name = String(i.name);
    return {
      rank: Number(i.rank),
      name,
      avatarUrl: githubAvatarUrl(name),
      earnedUsdc: amount(i.earnedUsdc) ?? 0,
      mergedPrs: Number(i.mergedPrs) || 0,
      assigned: Number(i.assigned) || 0,
      repos: Array.isArray(i.repos) ? i.repos.map(String) : [],
    };
  });
}

// Public, unauthenticated leaderboard. Not routed through the /api/backend proxy
// because that proxy forces an /api/v1 prefix; this endpoint lives at /api/leaderboard.
export async function fetchPublicLeaderboard(
  page: number,
  pageSize: number,
  network?: StellarNetwork
): Promise<LeaderboardPage> {
  const res = await fetch(
    `${remoteBackendUrl(network)}/api/leaderboard?page=${page}&pageSize=${pageSize}`,
    { next: { revalidate: 180 } }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    items: toEntries((data.items as Record<string, unknown>[]) ?? []),
    page: Number(data.page) || page,
    pageSize: Number(data.pageSize) || pageSize,
    total: Number(data.total) || 0,
    totalPages: Math.max(1, Number(data.totalPages) || 1),
  };
}
