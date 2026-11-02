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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <Pagination
      aria-label="Transaction pages"
      className="border-t border-border/70 px-4 py-4 sm:px-6"
    >
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text="Back"
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
      className="min-w-0 gap-0"
    >
      <Card className="animate-hero-in min-w-0 overflow-hidden rounded-3xl border-border/70 py-0 shadow-sm">
        <CardHeader className="block border-b border-border/70 px-4 pt-5 sm:px-6 sm:pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <CardTitle className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
                Activity
              </CardTitle>
              <CardDescription className="mt-1.5 max-w-2xl text-sm leading-6 sm:text-base">
                Newest first, with GitHub issues and Stellar transaction links.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="h-auto rounded-full px-3 py-1.5 text-xs">
                {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
              </Badge>
              <Badge className="h-auto rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary hover:bg-primary/10">
                {selectedFilter}
              </Badge>
            </div>
          </div>

          <div className="mt-5 min-w-0 overflow-x-auto pb-1 [scrollbar-width:thin]">
            <TabsList
              aria-label="Filter activity"
              className="h-auto min-w-max justify-start gap-1 rounded-xl p-1 group-data-horizontal/tabs:h-auto"
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
                    className="h-9 shrink-0 flex-none gap-1.5 px-3 py-1 text-xs font-semibold sm:text-sm"
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
                <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
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
              <div className="divide-y md:hidden">
                {paged.items.map((row) => {
                  const meta = KIND_STYLES[row.kind];
                  return (
                    <article key={row.id} className="space-y-3 px-4 py-4 text-[0.95rem]">
                      <div className="flex items-start justify-between gap-3">
                        <Badge
                          className={`h-auto rounded-full px-2.5 py-1 text-sm ${meta.className}`}
                        >
                          {meta.label}
                        </Badge>
                        <time className="shrink-0 text-sm text-muted-foreground">
                          {formatWhen(row.at)}
                        </time>
                      </div>
                      <IssueCell row={row} />
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-mono text-base font-semibold">
                          {row.amountUsdc == null ? '—' : formatUsdc(row.amountUsdc)}
                        </p>
                        {row.contributor ? (
                          <GithubUserLink name={row.contributor} compact className="text-base" />
                        ) : (
                          <span className="text-base text-muted-foreground">—</span>
                        )}
                      </div>
                      {row.txHash ? (
                        <TxCell hash={row.txHash} />
                      ) : (
                        <p className="text-sm text-muted-foreground">GitHub</p>
                      )}
                    </article>
                  );
                })}
              </div>

              <Table
                className="hidden min-w-[960px] table-fixed text-sm md:table lg:text-base"
                containerClassName="hidden overflow-x-auto md:block"
              >
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-12 w-[18%] px-4 whitespace-normal text-sm font-semibold tracking-wide text-muted-foreground">
                      When
                    </TableHead>
                    <TableHead className="h-12 w-[34%] px-4 whitespace-normal text-sm font-semibold tracking-wide text-muted-foreground">
                      Issue
                    </TableHead>
                    <TableHead className="h-12 w-[12%] px-4 whitespace-normal text-sm font-semibold tracking-wide text-muted-foreground">
                      Event
                    </TableHead>
                    <TableHead className="h-12 w-[14%] px-4 whitespace-normal text-sm font-semibold tracking-wide text-muted-foreground">
                      Amount
                    </TableHead>
                    <TableHead className="h-12 w-[12%] px-4 whitespace-normal text-sm font-semibold tracking-wide text-muted-foreground">
                      Contributor
                    </TableHead>
                    <TableHead className="h-12 w-[10%] px-4 whitespace-normal text-sm font-semibold tracking-wide text-muted-foreground">
                      Tx
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.items.map((row) => {
                    const meta = KIND_STYLES[row.kind];
                    return (
                      <TableRow key={row.id} className="hover:bg-muted/40">
                        <TableCell className="px-4 py-3.5 whitespace-normal text-muted-foreground">
                          {formatWhen(row.at)}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 whitespace-normal">
                          <IssueCell row={row} />
                        </TableCell>
                        <TableCell className="px-4 py-3.5 whitespace-normal">
                          <Badge
                            className={`h-auto rounded-full px-2.5 py-1 text-sm ${meta.className}`}
                          >
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3.5 font-mono text-base font-semibold whitespace-normal">
                          {row.amountUsdc == null ? '—' : formatUsdc(row.amountUsdc)}
                        </TableCell>
                        <TableCell className="max-w-0 px-4 py-3.5 whitespace-normal">
                          {row.contributor ? (
                            <GithubUserLink name={row.contributor} compact className="text-base" />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3.5 whitespace-normal">
                          {row.txHash ? (
                            <TxCell hash={row.txHash} />
                          ) : (
                            <span className="text-sm text-muted-foreground">GitHub</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
          <ActivityPagination page={paged.page} totalPages={paged.totalPages} onPage={setPage} />
        </CardContent>
      </Card>
    </Tabs>
  );
}
