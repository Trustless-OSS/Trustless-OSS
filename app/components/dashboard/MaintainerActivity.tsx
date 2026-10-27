'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import RepoFundsChart, { RepoRewardedChart } from '@/app/components/dashboard/RepoFundsChart';
import { fetchDashboardRepos } from '@/lib/dashboard-api';
import type { RepoChartPoint } from './activity';

export default function MaintainerActivity() {
  const [chartPoints, setChartPoints] = useState<RepoChartPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDashboardRepos()
      .then((points) => active && setChartPoints(points))
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error ? reason.message : 'Failed to load repository chart data.'
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const fundsPoints = (chartPoints ?? []).filter((point) => point.locked > 0 || point.released > 0);
  const rewardedPoints = (chartPoints ?? []).filter((point) => point.rewarded > 0);

  return (
    <section className="mt-6" aria-label="Repository funds">
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
            {chartPoints === null && !error ? (
              <Skeleton className="h-64 w-full" />
            ) : error ? (
              <p
                role="alert"
                className="flex h-64 items-center justify-center text-sm text-destructive"
              >
                {error}
              </p>
            ) : fundsPoints.length > 0 ? (
              <>
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
                <RepoFundsChart points={fundsPoints} />
              </>
            ) : (
              <ChartPlaceholder label="Repository funds chart" />
            )}
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
            {chartPoints === null && !error ? (
              <Skeleton className="h-64 w-full" />
            ) : error ? (
              <p
                role="alert"
                className="flex h-64 items-center justify-center text-sm text-destructive"
              >
                {error}
              </p>
            ) : rewardedPoints.length > 0 ? (
              <>
                <div className="mb-3 flex flex-wrap gap-3 text-xs font-medium text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Rewarded
                  </span>
                </div>
                <RepoRewardedChart points={rewardedPoints} />
              </>
            ) : (
              <ChartPlaceholder label="Explore Bounties chart" />
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function ChartPlaceholder({ label }: { label: string }) {
  return (
    <div
      role="img"
      aria-label={`${label}; waiting for data`}
      data-testid="empty-chart-skeleton"
      className="relative flex h-64 flex-col justify-between overflow-hidden rounded-xl border border-border/60 bg-muted/10 px-4 pb-4 pt-5"
    >
      <div className="absolute inset-4 grid grid-cols-4 divide-x divide-dashed divide-border/60">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="relative flex h-full flex-col justify-around">
        {[68, 46, 58, 34].map((width, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-3 w-16 shrink-0" />
            <Skeleton className="h-4 rounded-full" style={{ width: `${width}%` }} />
          </div>
        ))}
      </div>
      <Skeleton className="relative mt-3 h-3 w-full" />
    </div>
  );
}
