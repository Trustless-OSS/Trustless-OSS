'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Ban,
  Inbox,
  Layers,
  Lock,
  Tag,
  Unlock,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import GithubUserLink from '@/app/components/dashboard/GithubUserLink';
import {
  ACTIVITY_FILTERS,
  KIND_STYLES,
  filterActivity,
  formatUsdc,
  formatWhen,
  githubIssueUrl,
  shortenHash,
  txExplorerUrl,
  type ActivityFilter,
  type ActivityRow,
} from '@/app/components/dashboard/activity';
import { useActivity } from '@/app/components/dashboard/useActivity';
import { paginateItems } from '@/lib/paginate';
import { useNetwork } from '@/lib/network-config';

export const TX_PAGE_SIZE = 20;
export { paginateItems };

const FILTER_ICONS = {
  all: Layers,
  rewarded: Tag,
  locked: Lock,
  released: Unlock,
  assigned: UserPlus,
  unassigned: UserMinus,
  rejected: Ban,
} as const;

function IssueCell({ row }: { row: ActivityRow }) {
  if (!row.issueNumber) {
    return (
      <div className="min-w-0">
        <p className="font-semibold">Pool deposit</p>
        <p className="truncate text-sm text-muted-foreground">{row.repo}</p>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <a
        href={githubIssueUrl(row.repo, row.issueNumber)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex max-w-full items-start gap-1 text-[0.95rem] font-semibold text-foreground hover:text-primary"
      >
        <span className="line-clamp-2">
          #{row.issueNumber} {row.issueTitle}
        </span>
        <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      </a>
      <p className="truncate text-sm text-muted-foreground">{row.repo}</p>
    </div>
  );
}

function TxCell({ hash }: { hash: string }) {
  const [network] = useNetwork(); // hook (not getNetwork) keeps SSR/hydration hrefs consistent
  const href = txExplorerUrl(hash, network);
  // If the URL is invalid (#), show it as plain text instead of a broken link
  if (href === '#') {
    return (
      <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-muted-foreground">
        {shortenHash(hash)}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-primary hover:underline"
    >
      {shortenHash(hash)}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

function ActivityPagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const pages = [page - 1, page, page + 1].filter((number) => number >= 1 && number <= totalPages);

  return (
    <Pagination
      aria-label="Transaction pages"
      className="border-t border-border/70 px-4 py-4 sm:px-6"
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text="Prev"
            aria-label="Back"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
          />
        </PaginationItem>

        {pages.map((number) => (
          <PaginationItem key={number}>
            <PaginationLink
              isActive={number === page}
              onClick={() => onPage(number)}
              aria-label={`Page ${number}`}
            >
              {number}
            </PaginationLink>
          </PaginationItem>
        ))}

        <PaginationItem className="px-2 text-xs text-muted-foreground">
          of {totalPages}
        </PaginationItem>

        <PaginationItem>
          <PaginationNext
            aria-label="Next"
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

export default function TransactionHistory({ rows }: { rows?: ActivityRow[] }) {
  const fetched = useActivity();
  // rows prop (tests) overrides the fetched feed.
  const activity = rows ?? fetched.data ?? [];
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => filterActivity(activity, filter), [activity, filter]);
  const paged = useMemo(() => paginateItems(filtered, page, TX_PAGE_SIZE), [filtered, page]);
  const selectedFilter = ACTIVITY_FILTERS.find((item) => item.value === filter)?.label ?? 'All';

  const loading = rows == null && fetched.loading;
  const error = rows == null ? fetched.error : null;

  return (
    <Tabs
      value={filter}
      onValueChange={(value) => {
        setFilter(value as ActivityFilter);
        setPage(1);
      }}
      className="w-full min-w-0 flex-col gap-0"
    >
      <Card className="animate-hero-in w-full min-w-0 overflow-hidden rounded-xl border-border/70 py-0 shadow-sm">
        <CardHeader className="block border-b border-border/70 px-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="font-display text-lg font-extrabold tracking-tight sm:text-xl">
              Recent events
            </CardTitle>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          <div className="-mx-4 mt-5 min-w-0 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:-mx-6 sm:px-6">
            <TabsList
              aria-label="Filter activity"
              className="h-auto min-w-max justify-start gap-2 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto"
            >
              {ACTIVITY_FILTERS.map((item) => {
                const Icon = FILTER_ICONS[item.value];
                return (
                  <TabsTrigger
                    key={item.value}
                    value={item.value}
                    onClick={() => {
                      setFilter(item.value);
                      setPage(1);
                    }}
                    style={
                      filter === item.value
                        ? {
                            backgroundColor: 'var(--primary)',
                            color: 'var(--primary-foreground)',
                            borderColor: 'var(--primary)',
                          }
                        : undefined
                    }
                    className={`h-9 shrink-0 flex-none gap-1.5 rounded-md border px-3 py-1 text-xs font-semibold shadow-none sm:text-sm ${
                      filter === item.value
                        ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground dark:border-primary dark:bg-primary dark:text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {item.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {error ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <p className="px-6 py-16 text-center text-base font-semibold text-destructive">
                {error}
              </p>
            </div>
          ) : loading ? (
            <div className="flex min-h-[400px] items-center justify-center">
              <p className="px-6 py-16 text-center text-base font-semibold text-muted-foreground">
                Loading activity…
              </p>
            </div>
          ) : paged.items.length === 0 ? (
            <div className="flex min-h-[360px] items-center justify-center px-6 py-16">
              <div className="max-w-sm text-center">
                <span className="mx-auto flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/15">
                  <Inbox className="size-6" aria-hidden="true" />
                </span>
                <p className="mt-5 text-base font-bold text-foreground">
                  No {selectedFilter.toLowerCase()} activity yet
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Events matching this filter will appear here as repository rewards move through
                  the workflow.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/70 lg:hidden">
                {paged.items.map((row) => {
                  const meta = KIND_STYLES[row.kind];
                  const EventIcon = FILTER_ICONS[row.kind];
                  return (
                    <article key={row.id} className="space-y-3 px-4 py-4 sm:px-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge
                          className={`h-auto gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                        >
                          <EventIcon className="size-3.5" aria-hidden="true" />
                          {meta.label}
                        </Badge>
                        <time dateTime={row.at} className="shrink-0 text-xs text-muted-foreground">
                          {formatWhen(row.at)}
                        </time>
                      </div>
                      <IssueCell row={row} />
                      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border/60 pt-3">
                        {row.contributor ? (
                          <GithubUserLink name={row.contributor} compact />
                        ) : (
                          <span className="text-sm text-muted-foreground">No contributor</span>
                        )}
                        {row.amountUsdc != null && (
                          <span className="font-mono text-sm font-bold tabular-nums">
                            {formatUsdc(row.amountUsdc)}
                          </span>
                        )}
                      </div>
                      {row.txHash ? <TxCell hash={row.txHash} /> : null}
                    </article>
                  );
                })}
              </div>

              <Table
                className="hidden table-fixed text-sm lg:table"
                containerClassName="hidden lg:block"
              >
                <TableHeader>
                  <TableRow className="bg-muted/35 hover:bg-muted/35">
                    <TableHead className="h-11 w-[39%] px-6 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Issue
                    </TableHead>
                    <TableHead className="h-11 w-[13%] px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Event
                    </TableHead>
                    <TableHead className="h-11 w-[14%] px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Amount
                    </TableHead>
                    <TableHead className="h-11 w-[18%] px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Contributor
                    </TableHead>
                    <TableHead className="h-11 w-[16%] px-4 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Details
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.items.map((row) => {
                    const meta = KIND_STYLES[row.kind];
                    const EventIcon = FILTER_ICONS[row.kind];
                    return (
                      <TableRow key={row.id} className="hover:bg-muted/25">
                        <TableCell className="px-6 py-4 whitespace-normal">
                          <IssueCell row={row} />
                        </TableCell>
                        <TableCell className="px-4 py-4 whitespace-normal">
                          <Badge
                            className={`h-auto gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${meta.className}`}
                          >
                            <EventIcon className="size-3.5" aria-hidden="true" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-4 font-mono text-sm font-bold whitespace-normal tabular-nums">
                          {row.amountUsdc == null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            formatUsdc(row.amountUsdc)
                          )}
                        </TableCell>
                        <TableCell className="max-w-0 px-4 py-4 whitespace-normal">
                          {row.contributor ? (
                            <GithubUserLink name={row.contributor} compact />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 whitespace-normal">
                          <div className="flex flex-col items-start gap-1">
                            <time dateTime={row.at} className="text-xs text-muted-foreground">
                              {formatWhen(row.at)}
                            </time>
                            {row.txHash ? <TxCell hash={row.txHash} /> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
          {!error && !loading && paged.totalPages > 1 ? (
            <ActivityPagination page={paged.page} totalPages={paged.totalPages} onPage={setPage} />
          ) : null}
        </CardContent>
      </Card>
    </Tabs>
  );
}
