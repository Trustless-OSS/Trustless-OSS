import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RepoFundsChart, { RepoRewardedChart } from '@/app/components/dashboard/RepoFundsChart';

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

export const DEMO_ACTIVITY: ActivityRow[] = [
  {
    id: 'act_18',
    at: '2026-09-04T13:20:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 161,
    issueTitle: 'Reject stale bounty claim',
    kind: 'rejected',
    amountUsdc: null,
    contributor: 'octocat',
    txHash: null,
  },
  {
    id: 'act_17',
    at: '2026-09-04T12:55:00.000Z',
    repo: 'trustless-oss/sdk',
    issueNumber: 91,
    issueTitle: 'Drop inactive assignee',
    kind: 'unassigned',
    amountUsdc: null,
    contributor: 'stellar-dev',
    txHash: null,
  },
  {
    id: 'act_16',
    at: '2026-09-04T12:10:00.000Z',
    repo: 'trustless-oss/contracts',
    issueNumber: 9,
    issueTitle: 'Add replay-safe release path',
    kind: 'released',
    amountUsdc: 220,
    contributor: 'gaearon',
    txHash: '8c2d14a0e6b73951f4c0a9d2b8e30647a1d5f0c8b3e7a269d4c1e8b0f5a67314',
  },
  {
    id: 'act_15',
    at: '2026-09-04T11:40:00.000Z',
    repo: 'trustless-oss/contracts',
    issueNumber: 9,
    issueTitle: 'Add replay-safe release path',
    kind: 'assigned',
    amountUsdc: null,
    contributor: 'gaearon',
    txHash: null,
  },
  {
    id: 'act_14',
    at: '2026-09-04T11:05:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 142,
    issueTitle: 'Rate-limit bounty comment commands',
    kind: 'released',
    amountUsdc: 150,
    contributor: 'ryzen-xp',
    txHash: '3e9a70c1d5b8246f0a2c8e4d7b1f3059c6a0e3d8b5f2c147a9d6e0b4f1c58203',
  },
  {
    id: 'act_14a',
    at: '2026-09-04T10:58:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 142,
    issueTitle: 'Rate-limit bounty comment commands',
    kind: 'assigned',
    amountUsdc: null,
    contributor: 'ryzen-xp',
    txHash: null,
  },
  {
    id: 'act_13',
    at: '2026-09-04T10:48:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 155,
    issueTitle: 'Show bounty status on pull requests',
    kind: 'released',
    amountUsdc: 80,
    contributor: 'octocat',
    txHash: '21b8d4e0c7a9356f1d0c8a3b6e2f4075c9a1e6d0b4f8c259a7e3d1b0f6a84512',
  },
  {
    id: 'act_12',
    at: '2026-09-04T10:20:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 128,
    issueTitle: 'Improve contributor wallet onboarding',
    kind: 'released',
    amountUsdc: 50,
    contributor: 'octocat',
    txHash: 'c4f91e2a8b7d03e156aa90c2f11b84d7e9c3a0b5d62f18e47a1c9b0d3e5f72a6',
  },
  {
    id: 'act_11',
    at: '2026-09-03T18:40:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 128,
    issueTitle: 'Improve contributor wallet onboarding',
    kind: 'locked',
    amountUsdc: 50,
    contributor: 'octocat',
    txHash: '9e18c0b4d72a55f1a03e8c6d4b19f27e0a5d13c8b6e4f90a2c1d7b5e8f30416a',
  },
  {
    id: 'act_10',
    at: '2026-09-03T16:12:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 128,
    issueTitle: 'Improve contributor wallet onboarding',
    kind: 'assigned',
    amountUsdc: null,
    contributor: 'octocat',
    txHash: null,
  },
  {
    id: 'act_09',
    at: '2026-09-02T14:05:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 128,
    issueTitle: 'Improve contributor wallet onboarding',
    kind: 'rewarded',
    amountUsdc: 50,
    contributor: null,
    txHash: null,
  },
  {
    id: 'act_08',
    at: '2026-09-01T11:30:00.000Z',
    repo: 'trustless-oss/sdk',
    issueNumber: 88,
    issueTitle: 'Add CCTP payout route docs',
    kind: 'released',
    amountUsdc: 75,
    contributor: 'stellar-dev',
    txHash: 'b7a21d0e5c94f38a16b0e2d7c8a5f13e4d90b6c1a2e8f04735c6d9b0e1a4f582',
  },
  {
    id: 'act_07',
    at: '2026-08-31T09:18:00.000Z',
    repo: 'trustless-oss/sdk',
    issueNumber: 88,
    issueTitle: 'Add CCTP payout route docs',
    kind: 'locked',
    amountUsdc: 75,
    contributor: 'stellar-dev',
    txHash: '0d5a9c18e2b74f60a1c3d8e6b5f20947a3c1e8d0b6f4a259c7e1d3b8f0a6c412',
  },
  {
    id: 'act_06',
    at: '2026-08-30T20:44:00.000Z',
    repo: 'trustless-oss/sdk',
    issueNumber: 88,
    issueTitle: 'Add CCTP payout route docs',
    kind: 'rewarded',
    amountUsdc: 75,
    contributor: null,
    txHash: null,
  },
  {
    id: 'act_05',
    at: '2026-08-28T15:10:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 142,
    issueTitle: 'Rate-limit bounty comment commands',
    kind: 'locked',
    amountUsdc: 150,
    contributor: 'ryzen-xp',
    txHash: 'e2c8a1f0d6b34957c4e0a8d1b7f23590c6a3e1d8b0f4c259a7d6e3b1f8c04517',
  },
  {
    id: 'act_04',
    at: '2026-08-28T12:02:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: 142,
    issueTitle: 'Rate-limit bounty comment commands',
    kind: 'rewarded',
    amountUsdc: 150,
    contributor: null,
    txHash: null,
  },
  {
    id: 'act_03',
    at: '2026-08-22T08:55:00.000Z',
    repo: 'trustless-oss/contracts',
    issueNumber: 12,
    issueTitle: 'Harden milestone release checks',
    kind: 'rewarded',
    amountUsdc: 250,
    contributor: null,
    txHash: null,
  },
  {
    id: 'act_02',
    at: '2026-08-20T17:26:00.000Z',
    repo: 'trustless-oss/contracts',
    issueNumber: null,
    issueTitle: null,
    kind: 'locked',
    amountUsdc: 2000,
    contributor: null,
    txHash: '5b10d8c3a9e2467f0c1d4a8b6e3f9052a7c0e1d4b8f6a359c2e7d0b4f1a68320',
  },
  {
    id: 'act_01',
    at: '2026-08-18T13:40:00.000Z',
    repo: 'trustless-oss/web',
    issueNumber: null,
    issueTitle: null,
    kind: 'locked',
    amountUsdc: 1000,
    contributor: null,
    txHash: '17f3b9a0c5d8246e1a8c0f2d7b4e9035c6d1a8e0b5f2c479a3e6d1b8f0c45729',
  },
  // Test data: 40 fake contributors
  ...Array.from({ length: 40 }, (_, index) => {
    const i = index + 1;
    const names = [
      'alice-dev',
      'bob-builder',
      'charlie-code',
      'diana-dev',
      'eve-eng',
      'frank-fix',
      'grace-git',
      'henry-hack',
      'iris-infra',
      'jack-js',
      'kate-kick',
      'leo-logic',
      'mia-merge',
      'noah-node',
      'olivia-ops',
      'paul-pro',
      'quinn-query',
      'roger-repo',
      'sarah-sync',
      'tina-test',
      'uri-user',
      'vince-ver',
      'walter-web',
      'xena-x',
      'yara-yeah',
      'zeke-zip',
      'alex-all',
      'beth-best',
      'cole-code',
      'dana-day',
      'eden-edge',
      'finn-fine',
      'gina-go',
      'hector-hero',
      'ivy-i',
      'jude-jump',
      'kira-keen',
      'liam-light',
      'maya-make',
      'nora-note',
    ];
    const name = names[i % names.length];
    const amount = Math.floor(Math.random() * 500) + 50;
    const isReleased = Math.random() > 0.3;
    const kind: ActivityKind = isReleased ? 'released' : 'assigned';

    return {
      id: `test_${i}`,
      at: new Date(Date.now() - i * 3600000).toISOString(),
      repo: ['trustless-oss/web', 'trustless-oss/sdk', 'trustless-oss/contracts'][i % 3],
      issueNumber: 100 + i,
      issueTitle: `Test issue ${i}`,
      kind,
      amountUsdc: isReleased ? amount : null,
      contributor: name,
      txHash: isReleased ? `tx_${i.toString().padStart(64, '0')}` : null,
    } as ActivityRow;
  }),
];

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

export type LeaderboardEntry = {
  rank: number;
  name: string;
  avatarUrl: string;
  earnedUsdc: number;
  mergedPrs: number;
  assigned: number;
  repos: string[];
};

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

export const KIND_STYLES = KIND_META;

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

export default function MaintainerActivity({ rows = DEMO_ACTIVITY }: { rows?: ActivityRow[] }) {
  const chartPoints = toRepoChartPoints(rows);

  return (
    <section className="mt-6 space-y-4" aria-label="Repository funds">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-xl font-extrabold tracking-tight">
              Repository funds
            </CardTitle>
            <CardDescription>
              Locked escrow versus released payouts for every repository under this maintainer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                Released
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                Still locked
              </span>
            </div>
            <RepoFundsChart points={chartPoints} />
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-xl font-extrabold tracking-tight">
              Explore Bounties
            </CardTitle>
            <CardDescription>Issues marked rewarded in each repository.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Rewarded
              </span>
            </div>
            <RepoRewardedChart points={chartPoints} />
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
