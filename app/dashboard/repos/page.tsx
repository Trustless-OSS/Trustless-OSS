import { GitBranch, Plus, RefreshCw, SearchX } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import RepositoryEscrowCard from '@/app/components/escrow/RepositoryEscrowCard';
import ReposPagination, { REPO_PAGE_SIZE } from '@/app/components/dashboard/ReposPagination';
import ReposToolbar from '@/app/components/dashboard/ReposToolbar';
import SyncReposButton from '@/app/components/dashboard/SyncReposButton';
import ReposLoadErrorToast from '@/app/components/dashboard/ReposLoadErrorToast';
import { ReposCardSkeletonGrid } from '@/app/components/layout/PageSkeletons';
import { paginateItems } from '@/lib/paginate';
import { filterAndSortRepos, parseRepoQuery, parseRepoSort } from '@/lib/repo-filters';
import Button from '@/app/components/ui/Button';
import type { Repo } from '@/app/types';
import { Badge } from '@/components/ui/badge';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

function toNumber(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

type DashboardRepo = Repo & {
  created_at: string;
  github_installation_id?: number | null;
  githubInstallationId?: number | null;
};

function normalizeRepo(data: unknown): DashboardRepo | null {
  if (!data || typeof data !== 'object') return null;

  const repo = data as DashboardRepo & Record<string, unknown>;
  const rawInstallation =
    repo.github_installation_id ?? repo.githubInstallationId ?? repo['github_installation_id'];
  const installationId = Number(rawInstallation);

  return {
    ...repo,
    github_installation_id:
      Number.isInteger(installationId) && installationId > 0 ? installationId : null,
    escrow_balance: toNumber(repo.escrow_balance),
    xlm_balance: repo.xlm_balance === undefined ? undefined : toNumber(repo.xlm_balance),
    stellar_balance:
      repo.stellar_balance === undefined ? undefined : toNumber(repo.stellar_balance),
  };
}

function isDashboardRepo(repo: DashboardRepo | null): repo is DashboardRepo {
  return repo !== null;
}

async function getRepos(token: string): Promise<{ repos: DashboardRepo[]; error: string | null }> {
  const url = `${BACKEND}/api/repos`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {
        repos: [],
        error: `Backend URL "${url}" → HTTP ${res.status} non-JSON: ${text.substring(0, 120)}`,
      };
    }
    if (!res.ok) {
      return {
        repos: [],
        error: typeof data.error === 'string' ? data.error : `API error ${res.status}`,
      };
    }
    const rawRepos = Array.isArray(data.data)
      ? data.data
      : Array.isArray(data.repos)
        ? data.repos
        : [];
    const repos = Array.isArray(rawRepos)
      ? rawRepos.map(normalizeRepo).filter(isDashboardRepo)
      : [];
    return { repos, error: null };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return { repos: [], error: `Fetch to "${url}" failed: ${message}` };
  }
}

function installationIdsFrom(repos: DashboardRepo[]) {
  return [
    ...new Set(
      repos
        .map((repo) => Number(repo.github_installation_id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
}

function pageFromSearchParams(searchParams?: { [key: string]: string | string[] | undefined }) {
  const raw = searchParams?.page;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function installationIdFromSearchParams(searchParams?: {
  [key: string]: string | string[] | undefined;
}) {
  const raw = searchParams?.installation_id;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

interface ReposProps {
  // Match Next's PageProps: searchParams is a Promise or undefined
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ReposPage({ searchParams }: ReposProps) {
  // Await the Next-provided promise (may be undefined in tests)
  const paramsObj = searchParams ? await searchParams : undefined;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <div />;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token ?? '';
  const [{ repos, error: reposError }] = await Promise.all([getRepos(token)]);
  const query = parseRepoQuery(paramsObj?.q);
  const sort = parseRepoSort(paramsObj?.sort);
  const filtered = filterAndSortRepos(repos, query, sort);
  const paged = paginateItems(filtered, pageFromSearchParams(paramsObj), REPO_PAGE_SIZE);
  const isInstallSyncing = installationIdFromSearchParams(paramsObj) != null;

  const isNew = (createdAt: string) => {
    const created = new Date(createdAt).getTime();
    const now = new Date().getTime();
    return now - created < 5 * 60 * 1000;
  };

  return (
    <div className="w-full">
      {reposError ? <ReposLoadErrorToast message={reposError} /> : null}

      <header className="mb-6 md:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Repositories
            </h1>
            {isInstallSyncing ? (
              <p className="mt-1 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <RefreshCw className="size-3.5 animate-spin text-primary" aria-hidden="true" />
                Syncing repositories in the background…
              </p>
            ) : repos.length > 0 ? (
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                {filtered.length === repos.length
                  ? `${repos.length} connected`
                  : `${filtered.length} of ${repos.length} shown`}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {repos.length > 0 && <ReposToolbar query={query} sort={sort} />}
            <SyncReposButton token={token} installationIds={installationIdsFrom(repos)} />
            <Button
              href="/dashboard/connect-repo"
              size="md"
              className="h-10 shrink-0 rounded-md bg-emerald-500 px-4 text-sm whitespace-nowrap text-white shadow-sm hover:bg-emerald-600 dark:bg-emerald-500 dark:hover:bg-emerald-600"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              Add repository
            </Button>
          </div>
        </div>
      </header>

      {isInstallSyncing && repos.length === 0 ? (
        <ReposCardSkeletonGrid count={REPO_PAGE_SIZE} />
      ) : repos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/80 bg-muted/40 px-6 py-16 text-center">
          <div className="flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
            <GitBranch className="size-5" strokeWidth={2.25} aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {reposError ? 'Repositories unavailable' : 'No repositories yet'}
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              {reposError
                ? 'We could not reach the API. Try syncing again in a moment, or connect a repository when the service is back.'
                : 'Connect a GitHub repository to fund escrows, set reward tiers, and pay contributors when PRs merge.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <Button
              href="/dashboard/connect-repo"
              size="sm"
              className="rounded-md bg-emerald-500 px-3.5 text-white hover:bg-emerald-600"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              Add repository
            </Button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 bg-muted/40 px-6 py-14 text-center">
          <div className="flex size-11 items-center justify-center rounded-md bg-muted text-muted-foreground ring-1 ring-border">
            <SearchX className="size-5" strokeWidth={2.25} aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              No matching repositories
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Nothing matches that search or filter. Try another name or choose a different option.
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-3">
            {paged.items.map((repo) => (
              <div key={repo.id} className="relative">
                {isNew(repo.created_at) && (
                  <Badge className="absolute -top-3 -right-3 z-10">New</Badge>
                )}
                <RepositoryEscrowCard repo={repo} token={token} xlmUsdPrice={undefined} />
              </div>
            ))}
          </div>
          <ReposPagination
            page={paged.page}
            totalPages={paged.totalPages}
            query={{ q: query, sort }}
          />
        </>
      )}
    </div>
  );
}
