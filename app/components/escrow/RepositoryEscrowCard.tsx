'use client';

import { LockKeyhole, ShieldCheck } from 'lucide-react';
import DeployEscrowButton from './DeployEscrowButton';
import Button from '@/app/components/ui/Button';
import type { Repo } from '@/app/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface RepositoryEscrowCardProps {
  repo: Repo;
  token?: string;
  xlmUsdPrice?: number | null;
  onManage?: (repo: Repo) => void;
  isLoading?: boolean;
}

function formatBalance(value: number | undefined): string {
  const balance = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(balance);
}

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

export default function RepositoryEscrowCard({
  repo,
  token = '',
  xlmUsdPrice = null,
  onManage,
  isLoading = false,
}: RepositoryEscrowCardProps) {
  if (isLoading) {
    return (
      <Card
        aria-busy="true"
        aria-label="Loading repository escrow"
        className="flex flex-col rounded-3xl"
      >
        <CardHeader className="flex flex-row items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-2xl" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="mb-2 h-5 w-3/4" />
          <Skeleton className="mb-6 h-3 w-1/3" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    );
  }

  const [ownerFromName, repoNameFromFullName] = repo.full_name.split('/');
  const owner = repo.owner_username ?? ownerFromName ?? 'UNKNOWN_OWNER';
  const repoName = repoNameFromFullName ?? repo.full_name;
  const isSecured = Boolean(repo.escrow_contract_id);
  const xlmBalance = repo.xlm_balance ?? repo.stellar_balance;
  const hasLiveXlmPrice = typeof xlmUsdPrice === 'number' && Number.isFinite(xlmUsdPrice);
  const combinedValueUsd = hasLiveXlmPrice
    ? repo.escrow_balance + (xlmBalance ?? 0) * xlmUsdPrice
    : xlmBalance
      ? null
      : repo.escrow_balance;

  return (
    <Card className="flex flex-col rounded-3xl py-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pt-5">
        <div className="flex min-w-0 items-start gap-3">
          <div
            aria-hidden="true"
            className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-foreground text-lg font-extrabold text-background"
          >
            {repoName.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              {owner} / git:main
            </p>
            <h2
              className="title-brutal mt-1.5 truncate text-xl tracking-tight text-foreground not-italic sm:text-2xl"
              title={repoName}
            >
              {repoName}
            </h2>
          </div>
        </div>
        <Badge
          variant="secondary"
          className={`shrink-0 gap-1 ${repo.is_private ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}
        >
          <LockKeyhole size={12} strokeWidth={2.5} aria-hidden="true" />
          {repo.is_private ? 'Private' : 'Public'}
        </Badge>
      </CardHeader>

      <CardContent>
        <Badge
          variant="secondary"
          className={`mb-4 gap-2 ${isSecured ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'}`}
        >
          <ShieldCheck size={14} aria-hidden="true" />
          {isSecured ? 'Escrow Secured' : 'Unconfigured'}
        </Badge>

        <dl className="mb-4 grid gap-2 border-y border-border py-3">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm font-semibold text-muted-foreground">USDC Balance</dt>
            <dd className="text-lg font-black tracking-tight text-foreground sm:text-xl">
              {formatBalance(repo.escrow_balance)} <span className="text-sm font-bold">USDC</span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm font-semibold text-muted-foreground">XLM Balance</dt>
            <dd className="text-lg font-black tracking-tight text-foreground sm:text-xl">
              {formatBalance(xlmBalance)} <span className="text-sm font-bold">XLM</span>
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <dt className="text-sm font-semibold text-muted-foreground">Combined Value</dt>
            <dd className="text-base font-black tracking-tight text-primary sm:text-lg">
              {formatUsd(combinedValueUsd)}
            </dd>
          </div>
        </dl>
      </CardContent>

      <CardFooter className="mt-auto border-0 bg-transparent">
        {isSecured ? (
          <Button
            href={`/dashboard/repos/${repo.id}`}
            onClick={() => onManage?.(repo)}
            className="w-full text-center"
          >
            Manage
          </Button>
        ) : (
          <DeployEscrowButton
            repoId={repo.id}
            token={token}
            label="QUICK INITIALIZE"
            loadingLabel="INITIALIZING..."
            className="!bg-amber-400 !text-slate-950"
          />
        )}
      </CardFooter>
    </Card>
  );
}
