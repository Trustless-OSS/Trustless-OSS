'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, GitMerge, GitPullRequest, Inbox, Trophy } from 'lucide-react';
import Link from 'next/link';
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
import {
  formatUsdc,
  githubAvatarUrl,
  githubProfileUrl,
  type LeaderboardEntry,
} from '@/app/components/dashboard/activity';
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
      className={`escrow-event-log-feed overflow-hidden rounded-xl ${raised ? 'ring-2 ring-amber-300/80 dark:ring-amber-500/40 md:-mt-3' : ''}`}
    >
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <RankBadge rank={entry.rank} />
          {entry.rank === 1 ? (
            <Trophy className="h-5 w-5 text-amber-500" aria-hidden="true" />
          ) : null}
        </div>
        {/* Large, centered avatar so each top-3 contributor stands out */}
        <a
          href={githubProfileUrl(entry.name)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`@${entry.name} on GitHub`}
          className="flex flex-col items-center gap-3 font-semibold text-foreground hover:text-primary"
        >
          <img
            src={githubAvatarUrl(entry.name)}
            alt=""
            className={`rounded-full object-cover ring-2 ring-border ${raised ? 'size-24' : 'size-20'}`}
          />
          <span className="text-lg">@{entry.name}</span>
        </a>
      </CardHeader>
      <CardContent>
        <p className="text-center text-3xl font-black tracking-tight">
          {formatUsdc(entry.earnedUsdc)}
        </p>
      </CardContent>
    </Card>
  );
}

function RepositoryLink({ repo }: { repo?: string }) {
  if (!repo) return <span className="text-muted-foreground">—</span>;
  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      title={repo}
      className="inline-flex max-w-full items-center gap-1 font-semibold text-primary hover:underline"
    >
      <span className="truncate">{repo.split('/').at(-1)}</span>
      <ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
    </a>
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

      <Card className="escrow-event-log-feed min-w-0 overflow-hidden rounded-xl border-border/70 py-0 shadow-sm">
        <CardContent className="px-0 pb-0">
          {error ? (
            <div className="flex min-h-[320px] items-center justify-center px-6 py-12 text-center text-sm font-semibold text-destructive">
              {error}
            </div>
          ) : !entries && fetched == null ? (
            <div className="flex min-h-[320px] items-center justify-center px-6 py-12 text-center text-sm text-muted-foreground">
              Loading leaderboard…
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
              <span className="flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                <Inbox className="size-6" aria-hidden="true" />
              </span>
              <p className="mt-4 text-base font-bold">No contributors yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Rankings will appear here.</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/70 lg:hidden">
                {visible.map((entry) => (
                  <article key={entry.name} className="space-y-3 px-4 py-4 sm:px-6">
                    <div className="flex min-w-0 items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <RankBadge rank={entry.rank} />
                        <GithubUserLink name={entry.name} compact className="min-w-0" />
                      </div>
                      <span className="shrink-0 font-mono text-sm font-black tabular-nums sm:text-base">
                        {formatUsdc(entry.earnedUsdc)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5" title="Merged PRs">
                        <GitMerge className="size-3.5" aria-hidden="true" />
                        <span className="font-semibold text-foreground">
                          {entry.mergedPrs}
                        </span>{' '}
                        merged
                      </span>
                      <span className="inline-flex items-center gap-1.5" title="Assigned">
                        <GitPullRequest className="size-3.5" aria-hidden="true" />
                        <span className="font-semibold text-foreground">{entry.assigned}</span>{' '}
                        assigned
                      </span>
                      <span className="ml-auto min-w-0 max-w-full">
                        <RepositoryLink repo={entry.repos[0]} />
                      </span>
                    </div>
                  </article>
                ))}
              </div>

              <Table
                className="hidden table-fixed text-sm lg:table"
                containerClassName="hidden lg:block"
              >
                <TableHeader>
                  <TableRow className="bg-muted/35 hover:bg-muted/35">
                    <TableHead className="h-11 w-[9%] px-5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Rank
                    </TableHead>
                    <TableHead className="h-11 w-[28%] px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Contributor
                    </TableHead>
                    <TableHead className="h-11 w-[16%] px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Earned
                    </TableHead>
                    <TableHead className="h-11 w-[14%] px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Merged PRs
                    </TableHead>
                    <TableHead className="h-11 w-[13%] px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Assigned
                    </TableHead>
                    <TableHead className="h-11 w-[20%] px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Top Repository
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((entry) => (
                    <TableRow key={entry.name} className="hover:bg-muted/25">
                      <TableCell className="px-5 py-4">
                        <RankBadge rank={entry.rank} />
                      </TableCell>
                      <TableCell className="min-w-0 px-4 py-4">
                        <GithubUserLink name={entry.name} className="max-w-full" />
                      </TableCell>
                      <TableCell className="px-4 py-4 font-mono font-bold tabular-nums">
                        {formatUsdc(entry.earnedUsdc)}
                      </TableCell>
                      <TableCell className="px-4 py-4 font-semibold tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <GitMerge className="size-4 text-muted-foreground" aria-hidden="true" />
                          {entry.mergedPrs}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 font-semibold tabular-nums">
                        <span className="inline-flex items-center gap-1.5">
                          <GitPullRequest
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                          />
                          {entry.assigned}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0 px-4 py-4">
                        <RepositoryLink repo={entry.repos[0]} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}

          {hasMore && expandHref ? (
            <div className="flex justify-center border-t border-border/70 px-4 py-4 sm:px-6">
              <Link
                href={expandHref}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                View full leaderboard <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
