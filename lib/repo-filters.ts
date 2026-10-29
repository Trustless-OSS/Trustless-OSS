export const REPO_SORTS = [
  { value: 'deployed-first', label: 'Deployed first', group: 'sort' },
  { value: 'newest', label: 'Newest first', group: 'sort' },
  { value: 'oldest', label: 'Oldest first', group: 'sort' },
  { value: 'name', label: 'Name A–Z', group: 'sort' },
  { value: 'deployed', label: 'Deployed', group: 'filter' },
  { value: 'undeployed', label: 'Not deployed', group: 'filter' },
] as const;

export type RepoSort = (typeof REPO_SORTS)[number]['value'];

export const DEFAULT_REPO_SORT: RepoSort = 'deployed-first';

export type FilterableRepo = {
  full_name: string;
  owner_username?: string;
  created_at?: string;
  escrow_contract_id?: string | null;
  escrow_balance?: number;
};

export function repoPageHref(page: number, query: { q?: string; sort?: RepoSort | string } = {}) {
  const params = new URLSearchParams();
  const q = query.q?.trim();
  if (q) params.set('q', q);
  if (query.sort && query.sort !== DEFAULT_REPO_SORT) params.set('sort', query.sort);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/dashboard/repos?${search}` : '/dashboard/repos';
}

export function parseRepoQuery(value: unknown) {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === 'string' ? raw : '';
}

export function parseRepoSort(value: unknown): RepoSort {
  const raw = Array.isArray(value) ? value[0] : value;
  return REPO_SORTS.some((option) => option.value === raw) ? (raw as RepoSort) : DEFAULT_REPO_SORT;
}

function createdAt(repo: FilterableRepo) {
  const time = new Date(repo.created_at ?? 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isDeployed(repo: FilterableRepo) {
  return Boolean(repo.escrow_contract_id);
}

function numericAmount(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function compareBalance(left: FilterableRepo, right: FilterableRepo) {
  return numericAmount(right.escrow_balance) - numericAmount(left.escrow_balance);
}

export function filterAndSortRepos<T extends FilterableRepo>(
  repos: T[],
  query: string,
  sort: RepoSort
) {
  const needle = query.trim().toLowerCase();
  const searched = needle
    ? repos.filter((repo) => {
        const name = repo.full_name.toLowerCase();
        const owner = (repo.owner_username ?? '').toLowerCase();
        return name.includes(needle) || owner.includes(needle);
      })
    : repos;

  const filtered =
    sort === 'deployed'
      ? searched.filter(isDeployed)
      : sort === 'undeployed'
        ? searched.filter((repo) => !isDeployed(repo))
        : searched;

  return [...filtered].sort((left, right) => {
    if (sort === 'oldest') return createdAt(left) - createdAt(right);
    if (sort === 'name') return left.full_name.localeCompare(right.full_name);
    if (sort === 'newest') return createdAt(right) - createdAt(left);
    if (sort === 'deployed-first') {
      const byDeployed = Number(isDeployed(right)) - Number(isDeployed(left));
      if (byDeployed !== 0) return byDeployed;
    }
    const byBalance = compareBalance(left, right);
    if (byBalance !== 0) return byBalance;
    return createdAt(right) - createdAt(left);
  });
}
