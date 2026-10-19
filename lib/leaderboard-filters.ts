import type { LeaderboardEntry } from '@/app/components/dashboard/MaintainerActivity';

export const LEADERBOARD_SORTS = [
  { value: 'earned', label: 'Highest earned', group: 'sort' },
  { value: 'prs', label: 'Most merged PRs', group: 'sort' },
  { value: 'assigned', label: 'Most assigned', group: 'sort' },
  { value: 'name', label: 'Name A–Z', group: 'sort' },
] as const;

export type LeaderboardSort = (typeof LEADERBOARD_SORTS)[number]['value'];

export const DEFAULT_LEADERBOARD_SORT: LeaderboardSort = 'earned';

export function leaderboardPageHref(
  page: number,
  query: { q?: string; sort?: LeaderboardSort | string } = {}
) {
  const q = query.q?.trim();
  const sort = query.sort && query.sort !== DEFAULT_LEADERBOARD_SORT ? query.sort : null;

  const parts = ['/leaderboard', String(Math.max(1, page))];
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (sort) params.set('sort', sort);

  const search = params.toString();
  return search ? `${parts.join('/')}?${search}` : parts.join('/');
}

export function parseLeaderboardQuery(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : '';
}

export function parseLeaderboardSort(value: unknown): LeaderboardSort {
  const raw = Array.isArray(value) ? value[0] : value;
  return LEADERBOARD_SORTS.some((option) => option.value === raw)
    ? (raw as LeaderboardSort)
    : DEFAULT_LEADERBOARD_SORT;
}

export function filterAndSortLeaderboard(
  entries: LeaderboardEntry[],
  query: string,
  sort: LeaderboardSort
) {
  const needle = query.trim().toLowerCase();
  const searched = needle
    ? entries.filter((entry) => entry.name.toLowerCase().includes(needle))
    : entries;

  return [...searched].sort((left, right) => {
    if (sort === 'prs') return right.mergedPrs - left.mergedPrs;
    if (sort === 'assigned') return right.assigned - left.assigned;
    if (sort === 'name') return left.name.localeCompare(right.name);
    // 'earned' (default)
    return right.earnedUsdc - left.earnedUsdc;
  });
}
