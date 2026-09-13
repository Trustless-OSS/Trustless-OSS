'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  CircleDashed,
  Clock3,
  ListFilter,
  Search,
  Sparkles,
  Type,
} from 'lucide-react';
import { DEFAULT_REPO_SORT, repoPageHref, type RepoSort } from '@/lib/repo-filters';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const QUICK_FILTERS: {
  value: RepoSort;
  label: string;
  hint: string;
  icon: typeof ListFilter;
}[] = [
  {
    value: 'deployed-first',
    label: 'All repos',
    hint: 'Deployed first',
    icon: Sparkles,
  },
  {
    value: 'deployed',
    label: 'Deployed',
    hint: 'Escrow is live',
    icon: CheckCircle2,
  },
  {
    value: 'undeployed',
    label: 'Not deployed',
    hint: 'Needs setup',
    icon: CircleDashed,
  },
  {
    value: 'newest',
    label: 'Newest',
    hint: 'Recently added',
    icon: Clock3,
  },
  {
    value: 'name',
    label: 'Name A–Z',
    hint: 'Alphabetical',
    icon: Type,
  },
];

export default function ReposToolbar({ query, sort }: { query: string; sort: RepoSort }) {
  const router = useRouter();
  const [draft, setDraft] = useState(query);
  const isFiltered = sort !== DEFAULT_REPO_SORT;
  const activeFilter = QUICK_FILTERS.find((option) => option.value === sort) ?? QUICK_FILTERS[0];

  useEffect(() => {
    setDraft(query);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft.trim() === query.trim()) return;
      router.push(repoPageHref(1, { q: draft, sort }));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [draft, query, router, sort]);

  function applySort(value: string) {
    const next = value as RepoSort;
    if (next === sort) return;
    router.push(repoPageHref(1, { q: draft, sort: next }));
  }

  return (
    <div
      role="search"
      className="flex h-10 w-44 shrink-0 items-center overflow-hidden rounded-md border border-border bg-card shadow-sm sm:w-52"
    >
      <Label htmlFor="repo-search" className="sr-only">
        Search repositories
      </Label>
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id="repo-search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search…"
          className="h-10 border-0 bg-transparent pr-2 pl-9 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="mx-0.5 h-5 w-px shrink-0 bg-border" aria-hidden="true" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Filter repositories"
            title={activeFilter.label}
            className={cn(
              'mr-1 size-8 shrink-0 rounded-md text-muted-foreground hover:text-foreground',
              isFiltered && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
            )}
          >
            <ListFilter className="size-4" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-56 min-w-56 rounded-2xl p-2">
          <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Quick filters
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={sort} onValueChange={applySort}>
            {QUICK_FILTERS.map((option) => {
              const Icon = option.icon;
              return (
                <DropdownMenuRadioItem
                  key={option.value}
                  value={option.value}
                  className="cursor-pointer rounded-md px-2 py-2.5 pr-8"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground">
                        {option.label}
                      </span>
                      <span className="block text-xs text-muted-foreground">{option.hint}</span>
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
          {isFiltered && (
            <>
              <DropdownMenuSeparator className="my-2" />
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-center rounded-md px-2 py-2 text-sm font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
                onClick={() => applySort(DEFAULT_REPO_SORT)}
              >
                Clear filter
              </button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
