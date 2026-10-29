import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/app/components/layout/Navbar';
import ContributorLeaderboard from '@/app/components/dashboard/ContributorLeaderboard';
import LeaderboardToolbar from '@/app/components/dashboard/LeaderboardToolbar';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { fetchPublicLeaderboard } from '@/lib/dashboard-api';
import { getServerNetwork } from '@/lib/network-server';
import {
  filterAndSortLeaderboard,
  leaderboardPageHref,
  parseLeaderboardQuery,
  parseLeaderboardSort,
  type LeaderboardSort,
} from '@/lib/leaderboard-filters';

const LEADERBOARD_PAGE_SIZE = 30;

export const metadata: Metadata = {
  title: 'Contributor Leaderboard | Trustless OSS',
  description:
    'Global leaderboard of top open-source contributors on Trustless OSS, ranked by USDC earned.',
  robots: { index: true, follow: true },
};

interface LeaderboardPageProps {
  params: Promise<{ page: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LeaderboardPage(props: LeaderboardPageProps) {
  const params = await props.params;
  const searchParams = await props.searchParams;

  const pageNum = Math.max(1, Number.parseInt(params.page || '1', 10));
  const query = parseLeaderboardQuery(searchParams.q);
  const sort = parseLeaderboardSort(searchParams.sort);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let page: Awaited<ReturnType<typeof fetchPublicLeaderboard>> | null = null;
  let loadError: string | null = null;
  try {
    page = await fetchPublicLeaderboard(pageNum, LEADERBOARD_PAGE_SIZE, await getServerNetwork());
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Failed to load leaderboard.';
  }

  // Redirect if page is out of range (server already clamps, so this only fires on >1).
  if (page && pageNum > page.totalPages && pageNum > 1) {
    redirect(leaderboardPageHref(page.totalPages, { q: query, sort }));
  }

  // shortcut: q/sort apply only within the current server page (the public API has no
  // q/sort params); upgrade when the backend adds them.
  const items = page ? filterAndSortLeaderboard(page.items, query, sort) : [];
  const totalPages = page?.totalPages ?? 1;

  return (
    <>
      <Navbar user={user} />
      <main className="relative z-10 flex-1 px-3 py-8 sm:px-4 md:px-6 lg:px-8 lg:py-12">
        <div className="mx-auto w-full max-w-4xl sm:max-w-5xl lg:max-w-6xl">
          {/* Header and Search in same row */}
          <div className="mb-8 flex flex-col items-start justify-between gap-4 md:mb-10 md:flex-row md:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                Across every repository
              </p>
              <h1 className="font-display mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl">
                Contributor leaderboard
              </h1>
            </div>
            <div className="w-full md:w-auto">
              <LeaderboardToolbar query={query} sort={sort} />
            </div>
          </div>

          {/* Leaderboard Table */}
          {loadError ? (
            <p className="rounded-3xl border border-border bg-card px-6 py-16 text-center text-base font-semibold text-destructive">
              {loadError}
            </p>
          ) : (
            <ContributorLeaderboard entries={items} hidePodium={pageNum !== 1} />
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <LeaderboardPagination
              page={pageNum}
              totalPages={totalPages}
              query={query}
              sort={sort}
            />
          )}
        </div>
      </main>
    </>
  );
}

function LeaderboardPagination({
  page,
  totalPages,
  query,
  sort,
}: {
  page: number;
  totalPages: number;
  query: string;
  sort: LeaderboardSort;
}) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  const showEllipsis = totalPages > 10;
  const displayPages = showEllipsis ? pages.slice(0, 9) : pages;

  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          {page > 1 ? (
            <PaginationPrevious href={leaderboardPageHref(page - 1, { q: query, sort })} />
          ) : (
            <PaginationPrevious disabled />
          )}
        </PaginationItem>

        {displayPages.map((num) => (
          <PaginationItem key={num}>
            <PaginationLink
              href={leaderboardPageHref(num, { q: query, sort })}
              isActive={num === page}
            >
              {num}
            </PaginationLink>
          </PaginationItem>
        ))}

        {showEllipsis && totalPages > 10 && (
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
        )}

        <PaginationItem>
          {page < totalPages ? (
            <PaginationNext href={leaderboardPageHref(page + 1, { q: query, sort })} />
          ) : (
            <PaginationNext disabled />
          )}
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
