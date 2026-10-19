'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import RepoFundsChart, { RepoRewardedChart } from '@/app/components/dashboard/RepoFundsChart';
import { useActivity } from '@/app/components/dashboard/useActivity';
import { toRepoChartPoints } from '@/app/components/dashboard/activity';

export default function MaintainerActivity() {
  const { data, loading, error } = useActivity();
  const chartPoints = toRepoChartPoints(data ?? []);

  return (
    <section className="mt-6 space-y-4" aria-label="Repository funds">
      {error ? (
        <p className="rounded-3xl border border-border bg-card px-6 py-4 text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-xl font-extrabold tracking-tight">
              Repository funds
            </CardTitle>
            <CardDescription>
              Locked escrow versus released payouts for every repository under this maintainer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-violet-500" />
                Released
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                Still locked
              </span>
            </div>
            {loading ? <Skeleton className="h-64 w-full" /> : <RepoFundsChart points={chartPoints} />}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="font-display text-xl font-extrabold tracking-tight">
              Explore Bounties
            </CardTitle>
            <CardDescription>Issues marked rewarded in each repository.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Rewarded
              </span>
            </div>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <RepoRewardedChart points={chartPoints} />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
