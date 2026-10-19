'use client';

import { useMemo, useState } from 'react';
import { ArrowUpRight, Ban, Layers, Lock, Tag, Unlock, UserMinus, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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
  const href = txExplorerUrl(hash);
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

  const loading = rows == null && fetched.loading;
  const error = rows == null ? fetched.error : null;

  return (
    <Tabs
      value={filter}
      onValueChange={(value) => {
        setFilter(value as ActivityFilter);
        setPage(1);
      }}
      className="gap-0"
    >
      <Card className="overflow-visible rounded-3xl py-0">
        <CardHeader className="border-b border-border/70 pt-6">
          <CardTitle className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">
            Activity
          </CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Newest first, with GitHub issues and Stellar transaction links.
          </CardDescription>
          <CardAction className="max-sm:col-span-full max-sm:mt-2 max-sm:justify-self-start">
            <TabsList
              aria-label="Filter activity"
              className="h-auto w-fit max-w-full flex-wrap gap-0.5 rounded-xl p-1 group-data-horizontal/tabs:h-auto"
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
                    className="h-8 shrink-0 gap-1 px-2.5 py-1 text-xs font-semibold sm:text-sm"
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {item.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </CardAction>
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
            <div className="flex min-h-[400px] items-center justify-center">
              <p className="px-6 py-16 text-center text-base font-semibold text-muted-foreground">
                No activity in this filter.
              </p>
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
                className="hidden table-fixed text-base md:table"
                containerClassName="hidden overflow-x-hidden md:block"
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
