// Pure, server-safe types and derivation helpers for the activity feed and leaderboard.
// Kept out of the 'use client' component so server code (lib/dashboard-api.ts, the
// leaderboard page) can import these without the client/server boundary error.

export type ActivityKind =
  'rewarded' | 'locked' | 'released' | 'assigned' | 'unassigned' | 'rejected';
export type ActivityFilter = ActivityKind | 'all';

export type ActivityRow = {
  id: string;
  at: string;
  repo: string;
  issueNumber: number | null;
  issueTitle: string | null;
  kind: ActivityKind;
  amountUsdc: number | null;
  contributor: string | null;
  txHash: string | null;
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  avatarUrl: string;
  earnedUsdc: number;
  mergedPrs: number;
  assigned: number;
  repos: string[];
};

const KIND_META: Record<ActivityKind, { label: string; className: string }> = {
  rewarded: {
    label: 'Rewarded',
    className:
      'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15',
  },
  locked: {
    label: 'Locked',
    className:
      'bg-primary/15 text-primary hover:bg-primary/15 dark:bg-primary/20 dark:text-primary dark:hover:bg-primary/20',
  },
  released: {
    label: 'Released',
    className:
      'bg-violet-100 text-violet-800 hover:bg-violet-100 dark:bg-violet-500/15 dark:text-violet-300 dark:hover:bg-violet-500/15',
  },
  assigned: {
    label: 'Assigned',
    className:
      'bg-muted text-muted-foreground hover:bg-muted dark:bg-white/10 dark:text-foreground dark:hover:bg-white/10',
  },
  unassigned: {
    label: 'Unassigned',
    className:
      'bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/15',
  },
  rejected: {
    label: 'Rejected',
    className:
      'bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/15',
  },
};

export const KIND_STYLES = KIND_META;

export function filterActivity(rows: ActivityRow[], filter: ActivityFilter): ActivityRow[] {
  if (filter === 'all') return rows;
  return rows.filter((row) => row.kind === filter);
}

export function rollupByRepo(rows: ActivityRow[]) {
  const map = new Map<
    string,
    { repo: string; rewarded: number; locked: number; released: number; lastAt: string }
  >();

  for (const row of rows) {
    const current = map.get(row.repo) ?? {
      repo: row.repo,
      rewarded: 0,
      locked: 0,
      released: 0,
      lastAt: row.at,
    };
    if (row.kind === 'rewarded') current.rewarded += 1;
    if (row.kind === 'locked') current.locked += row.amountUsdc ?? 0;
    if (row.kind === 'released') current.released += row.amountUsdc ?? 0;
    if (Date.parse(row.at) > Date.parse(current.lastAt)) current.lastAt = row.at;
    map.set(row.repo, current);
  }

  return [...map.values()].sort((a, b) => Date.parse(b.lastAt) - Date.parse(a.lastAt));
}

export function summarizeActivity(rows: ActivityRow[]) {
  return {
    rewarded: rows.filter((row) => row.kind === 'rewarded').length,
    locked: rows
      .filter((row) => row.kind === 'locked')
      .reduce((sum, row) => sum + (row.amountUsdc ?? 0), 0),
    released: rows
      .filter((row) => row.kind === 'released')
      .reduce((sum, row) => sum + (row.amountUsdc ?? 0), 0),
  };
}

export function listContributors(rows: ActivityRow[]) {
  return buildLeaderboard(rows).map((contributor) => ({
    name: contributor.name,
    repos: contributor.repos,
  }));
}

export function githubAvatarUrl(name: string) {
  return `https://github.com/${name}.png?size=96`;
}

export function githubProfileUrl(name: string) {
  return `https://github.com/${name}`;
}

export function buildLeaderboard(rows: ActivityRow[]): LeaderboardEntry[] {
  const map = new Map<
    string,
    { name: string; earnedUsdc: number; mergedPrs: number; assigned: number; repos: Set<string> }
  >();

  for (const row of rows) {
    if (!row.contributor) continue;
    const current = map.get(row.contributor) ?? {
      name: row.contributor,
      earnedUsdc: 0,
      mergedPrs: 0,
      assigned: 0,
      repos: new Set<string>(),
    };
    current.repos.add(row.repo);
    if (row.kind === 'assigned') current.assigned += 1;
    if (row.kind === 'released') {
      current.mergedPrs += 1;
      current.earnedUsdc += row.amountUsdc ?? 0;
    }
    map.set(row.contributor, current);
  }

  return [...map.values()]
    .sort(
      (a, b) =>
        b.earnedUsdc - a.earnedUsdc || b.mergedPrs - a.mergedPrs || a.name.localeCompare(b.name)
    )
    .map((contributor, index) => ({
      rank: index + 1,
      name: contributor.name,
      avatarUrl: githubAvatarUrl(contributor.name),
      earnedUsdc: contributor.earnedUsdc,
      mergedPrs: contributor.mergedPrs,
      assigned: contributor.assigned,
      repos: [...contributor.repos].sort(),
    }));
}

export function shortenHash(hash: string, chars = 4) {
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

export function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function txExplorerUrl(hash: string) {
  return `https://stellar.expert/explorer/public/tx/${hash}`;
}

export function githubIssueUrl(repo: string, issueNumber: number) {
  return `https://github.com/${repo}/issues/${issueNumber}`;
}

export const ACTIVITY_FILTERS: { value: ActivityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'rewarded', label: 'Rewarded' },
  { value: 'locked', label: 'Locked' },
  { value: 'released', label: 'Released' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'rejected', label: 'Rejected' },
];

export function formatUsdc(amount: number) {
  return `${amount.toLocaleString('en-US')} USDC`;
}

export function toRepoChartPoints(rows: ActivityRow[]) {
  return rollupByRepo(rows).map((repo) => ({
    name: repo.repo.split('/')[1] ?? repo.repo,
    repo: repo.repo,
    locked: repo.locked,
    released: repo.released,
    remaining: Math.max(0, repo.locked - repo.released),
    rewarded: repo.rewarded,
  }));
}
