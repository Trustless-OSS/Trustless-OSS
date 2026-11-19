'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CircleDot } from 'lucide-react';
import { fetchBountyPage, fetchRecentBounties, type RecentBounty } from '@/lib/dashboard-api';
import { formatUsdc, githubIssueUrl } from '@/app/components/dashboard/activity';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationLink,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function RecentBounties({ page }: { page?: number }) {
  const Heading = page ? 'h1' : 'h2';
  const [hasMore, setHasMore] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const pageNumbers = [...new Set([1, (page ?? 1) - 1, page ?? 1, (page ?? 1) + 1, totalPages])]
    .filter((n) => n >= 1 && n <= totalPages)
    .sort((a, b) => a - b);
  const [bounties, setBounties] = useState<RecentBounty[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setError(false);
    setBounties(null);
    setHasMore(false);
    const request = page
      ? fetchBountyPage(page)
      : fetchRecentBounties().then((items) => ({
          items: items.slice(0, 5),
          hasMore: false,
          totalPages: 1,
        }));
    request
      .then((result) => {
        if (active) {
          setBounties(result.items);
          setHasMore(result.hasMore);
          setTotalPages(result.totalPages);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [attempt, page]);

  return (
    <section aria-labelledby="recent-bounties-title" className="mb-20 md:mb-28">
      <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        Newly added bounties
      </p>
      <Heading
        id="recent-bounties-title"
        className="font-display mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl"
      >
        {page ? 'Rewarded issues' : 'Find your next issue.'}
      </Heading>
      <p className="mt-3 mb-6 max-w-2xl leading-7 text-muted-foreground">
        Browse open bounties and request assignment on GitHub.
      </p>
      <Card className="escrow-event-log-feed min-w-0 overflow-hidden rounded-xl border-border/70 py-0 shadow-sm">
        <CardContent className="px-0 pb-0">
          {error ? (
            <div role="status" className="p-8 text-center">
              <p>Recent bounties are temporarily unavailable.</p>
              <button
                type="button"
                onClick={() => setAttempt(attempt + 1)}
                className="mt-3 min-h-11 px-4 font-semibold text-primary underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          ) : bounties === null ? (
            <p role="status" className="p-8 text-center text-muted-foreground">
              Loading recent bounties…
            </p>
          ) : bounties.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">
              {page && page > 1
                ? 'No available issues on this page. Try another page.'
                : 'No open bounties available yet. Check back soon.'}
            </p>
          ) : (
            <Table aria-label="Rewarded issues" className="block text-base lg:table lg:table-fixed">
              <TableHeader className="hidden lg:table-header-group">
                <TableRow className="bg-muted/35 hover:bg-muted/35">
                  {[
                    ['Issue', 'lg:w-[33%]'],
                    ['Repository', 'lg:w-[22%]'],
                    ['Reward', 'lg:w-[16%]'],
                    ['Status', 'lg:w-[11%]'],
                    ['Added', 'lg:w-[18%]'],
                  ].map(([label, width]) => (
                    <TableHead
                      key={label}
                      scope="col"
                      className={`h-14 px-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase ${width}`}
                    >
                      {label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="block lg:table-row-group">
                {bounties.map((bounty) => (
                  <TableRow
                    key={bounty.id}
                    className="grid grid-cols-2 gap-x-3 gap-y-4 border-border/70 p-4 hover:bg-muted/25 sm:px-6 lg:table-row lg:p-0"
                  >
                    <TableCell className="col-span-2 min-w-0 whitespace-normal! p-0 lg:px-4 lg:py-6">
                      <a
                        href={githubIssueUrl(bounty.repo, bounty.issueNumber)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-start gap-2 font-semibold text-foreground hover:text-primary hover:underline"
                      >
                        <span className="shrink-0 text-muted-foreground">
                          #{bounty.issueNumber}
                        </span>
                        <span className="min-w-0 wrap-break-word">
                          {bounty.issueTitle || 'Untitled issue'}
                        </span>
                        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      </a>
                    </TableCell>
                    <TableCell className="col-span-2 min-w-0 p-0 lg:px-4 lg:py-6">
                      <a
                        href={`https://github.com/${bounty.repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={bounty.repo}
                        className="block truncate font-semibold text-primary hover:underline"
                      >
                        {bounty.repo.split('/').at(-1)}
                      </a>
                    </TableCell>
                    <TableCell className="min-w-0 whitespace-normal! p-0 font-mono font-bold tabular-nums lg:px-4 lg:py-6">
                      {formatUsdc(bounty.amountUsdc)}
                    </TableCell>
                    <TableCell className="p-0 text-right lg:px-4 lg:py-6 lg:text-left">
                      <Badge
                        variant="secondary"
                        className="h-auto gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                      >
                        <CircleDot className="size-3" aria-hidden="true" />
                        Open
                      </Badge>
                    </TableCell>
                    <TableCell className="col-span-2 border-t border-border/60 p-0 pt-3 text-xs text-muted-foreground lg:border-0 lg:px-4 lg:py-6 lg:text-sm">
                      <span className="lg:hidden">Added </span>
                      <time dateTime={bounty.at}>
                        {new Date(bounty.at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'Asia/Kolkata',
                        })}
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {new Date(bounty.at).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                            timeZone: 'Asia/Kolkata',
                          })}{' '}
                          IST
                        </span>
                      </time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!page && (
            <div className="flex justify-center border-t border-border/70 px-4 py-4 sm:px-6">
              <Link
                href="/explore"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Explore more <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
      {page && bounties !== null && !error ? (
        <Pagination className="mt-6">
          <PaginationContent className="flex-wrap justify-center">
            <PaginationItem>
              {page > 1 ? (
                <PaginationPrevious text="Back" href={`/explore?page=${page - 1}`} />
              ) : (
                <PaginationPrevious text="Back" disabled />
              )}
            </PaginationItem>
            {pageNumbers.map((number, index) => (
              <Fragment key={number}>
                {index > 0 && number - pageNumbers[index - 1] > 1 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink
                    href={`/explore?page=${number}`}
                    isActive={number === page}
                    aria-label={`Page ${number}`}
                  >
                    {number}
                  </PaginationLink>
                </PaginationItem>
              </Fragment>
            ))}
            <PaginationItem>
              {hasMore && !error ? (
                <PaginationNext href={`/explore?page=${page + 1}`} />
              ) : (
                <PaginationNext disabled />
              )}
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </section>
  );
}
