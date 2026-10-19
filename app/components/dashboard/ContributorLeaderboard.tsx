'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, GitMerge, GitPullRequest, Trophy } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import GithubUserLink from '@/app/components/dashboard/GithubUserLink';
import { formatUsdc, type LeaderboardEntry } from '@/app/components/dashboard/activity';
import { fetchPublicLeaderboard } from '@/lib/dashboard-api';

const RANK_STYLE: Record<number, string> = {
  1: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  2: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-foreground',
  3: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
};

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-base font-black ${
        RANK_STYLE[rank] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {rank}
    </span>
  );
}

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  const raised = entry.rank === 1;

  return (
    <Card
      className={`rounded-3xl ${raised ? 'ring-2 ring-amber-300/80 dark:ring-amber-500/40 md:-mt-3' : ''}`}
    >
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <RankBadge rank={entry.rank} />
          {entry.rank === 1 ? (
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
          ) : null}
        </div>
        <GithubUserLink name={entry.name} size="lg" className="text-lg" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-3xl font-black tracking-tight">{formatUsdc(entry.earnedUsdc)}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="h-auto rounded-full px-3 py-1 text-sm">
            {entry.mergedPrs} merged PR{entry.mergedPrs === 1 ? '' : 's'}
          </Badge>
          <Badge variant="outline" className="h-auto rounded-full px-3 py-1 text-sm">
            {entry.assigned} assigned
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export type ContributorLeaderboardProps = {
  /** List of already-paginated entries to display in the table. */
  entries?: LeaderboardEntry[];
  /** Preview mode: show only the top N rows and a "See more" button. */
  limit?: number;
  /** Href for "See more" expand links (home preview only). */
  expandHref?: string;
  /** Show "See more" button (home preview). */
  showSeeMore?: boolean;
  /** Hide podium cards (leaderboard paginated pages). */
  hidePodium?: boolean;
};

export default function ContributorLeaderboard({
  entries,
  limit,
  expandHref,
  hidePodium,
}: ContributorLeaderboardProps) {
  // When entries are passed (the paginated /leaderboard page) render them directly.
  // Otherwise this is the home preview: fetch the public, grand-total leaderboard.
  const [fetched, setFetched] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (entries) return;
    let active = true;
    fetchPublicLeaderboard(1, limit ?? 5)
      .then((p) => active && setFetched(p.items))
      .catch((e) => active && setError(e?.message || 'Failed to load leaderboard.'));
    return () => {
      active = false;
    };
  }, [entries, limit]);

  const leaderboard = entries ?? fetched ?? [];
  const podium = entries ? [] : leaderboard.slice(0, 3);
  const visible = limit != null ? leaderboard.slice(0, limit) : leaderboard;
  const hasMore = limit != null && leaderboard.length > limit;

  return (
    <div className="space-y-6">
      {!hidePodium && podium.length > 0 ? (
        <section aria-labelledby="leaderboard-podium-heading">
          <h2 id="leaderboard-podium-heading" className="sr-only">
            Top contributors
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            {podium.map((entry) => (
              <div
                key={entry.name}
                className={
                  entry.rank === 1 ? 'md:order-2' : entry.rank === 2 ? 'md:order-1' : 'md:order-3'
                }
              >
                <PodiumCard entry={entry} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Card className="rounded-3xl py-0">
        <CardContent className="px-0 pb-0">
          {error ? (
            <p className="px-6 py-16 text-center text-base font-semibold text-destructive">
              {error}
            </p>
          ) : !entries && fetched == null ? (
            <p className="px-6 py-16 text-center text-base font-semibold text-muted-foreground">
              Loading leaderboard…
            </p>
          ) : leaderboard.length === 0 ? (
            <p className="px-6 py-16 text-center text-base font-semibold text-muted-foreground">
              No contributors yet.
            </p>
          ) : (
            <Table className="text-base">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-14 px-6 text-sm font-semibold tracking-wide text-muted-foreground">
                    Rank
                  </TableHead>
                  <TableHead className="h-14 px-6 text-sm font-semibold tracking-wide text-muted-foreground">
                    Contributor
                  </TableHead>
                  <TableHead className="h-14 px-6 text-sm font-semibold tracking-wide text-muted-foreground">
                    Earned
                  </TableHead>
                  <TableHead className="h-14 px-6 text-sm font-semibold tracking-wide text-muted-foreground">
                    Merged PRs
                  </TableHead>
                  <TableHead className="h-14 px-6 text-sm font-semibold tracking-wide text-muted-foreground">
                    Assigned
                  </TableHead>
                  <TableHead className="h-14 px-6 text-sm font-semibold tracking-wide text-muted-foreground">
                    Top Repository
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((entry) => (
                  <TableRow key={entry.name} className="hover:bg-muted/40">
                    <TableCell className="px-6 py-5">
                      <RankBadge rank={entry.rank} />
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <GithubUserLink name={entry.name} size="lg" className="text-lg" />
                    </TableCell>
                    <TableCell className="px-6 py-5 font-mono text-lg font-black tracking-tight">
                      {formatUsdc(entry.earnedUsdc)}
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <GitMerge className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {entry.mergedPrs}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <GitPullRequest
                          className="h-4 w-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {entry.assigned}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-5">
                      {entry.repos.length > 0 ? (
                        <a
                          href={`https://github.com/${entry.repos[0]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline font-semibold"
                        >
                          {entry.repos[0]}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {hasMore && expandHref ? (
            <div className="border-t border-border/70 px-6 py-5 flex justify-center">
              <Link
                href={expandHref}
                className="inline-flex items-center gap-1.5 text-base font-semibold text-primary hover:underline"
              >
                View full leaderboard
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
