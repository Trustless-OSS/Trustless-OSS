import { authHeaders, backendUrl, remoteBackendUrl } from '@/lib/backend';
import { createClient } from '@/lib/supabase/client';
import {
  githubAvatarUrl,
  type ActivityRow,
  type LeaderboardEntry,
} from '@/app/components/dashboard/activity';

// Contract: docs/DASHBOARD_API.md. Amounts arrive as decimal strings and are parsed
// to numbers here so the existing derivation helpers/components stay unchanged.

export type FundsMovementPoint = { month: string; period: string; tvl: number; payouts: number };

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
  const rows = await getAuthed<Record<string, unknown>[]>('/dashboard/activity');
  if (!Array.isArray(rows)) throw new Error('Unexpected activity response from the server.');
  return rows.map((r) => ({
    id: String(r.id),
    at: String(r.at),
    repo: String(r.repo),
    issueNumber: ((r.issueNumber as number | null) || (r.issue_number as number | null)) ?? null,
    issueTitle: ((r.issueTitle as string | null) || (r.issue_title as string | null)) ?? null,
    kind: (r.kind || r.type) as ActivityRow['kind'],
    amountUsdc: amount(r.amountUsdc || r.amount_usdc),
    contributor: ((r.contributor as string | null) || (r.user as string | null)) ?? null,
    // Try camelCase first, then snake_case
    txHash: ((r.txHash as string | null) || (r.tx_hash as string | null)) ?? null,
  }));
}

export async function fetchFundsMovement(): Promise<FundsMovementPoint[]> {
  const points = await getAuthed<Record<string, unknown>[]>('/dashboard/funds-movement');
  if (!Array.isArray(points))
    throw new Error('Unexpected funds-movement response from the server.');
  return points.map((p) => ({
    month: String(p.month),
    period: String(p.period),
    tvl: amount(p.tvl) ?? 0,
    payouts: amount(p.payouts) ?? 0,
  }));
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
  pageSize: number
): Promise<LeaderboardPage> {
  const res = await fetch(
    `${remoteBackendUrl()}/api/leaderboard?page=${page}&pageSize=${pageSize}`,
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
