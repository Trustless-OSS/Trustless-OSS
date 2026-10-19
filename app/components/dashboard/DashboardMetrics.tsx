'use client';

import { Lock, Tag, Unlock, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatUsdc,
  githubAvatarUrl,
  githubProfileUrl,
  listContributors,
  summarizeActivity,
} from '@/app/components/dashboard/activity';
import { useActivity } from '@/app/components/dashboard/useActivity';

export default function DashboardMetrics() {
  const { data, loading, error } = useActivity();

  if (loading) {
    return <Skeleton className="mb-6 h-56 w-full rounded-3xl" />;
  }
  if (error) {
    return (
      <p className="mb-6 rounded-3xl border border-border bg-card px-6 py-4 text-sm font-medium text-destructive">
        {error}
      </p>
    );
  }

  const rows = data ?? [];
  const totals = summarizeActivity(rows);
  const contributors = listContributors(rows);
  const visibleContributors = contributors.slice(0, 6); // Show only 6 contributors
  const moved = totals.locked + totals.released;
  const lockedShare = moved === 0 ? 0 : Math.round((totals.locked / moved) * 100);
  const releasedShare = moved === 0 ? 0 : Math.round((totals.released / moved) * 100);

  return (
    <div className="mb-6 space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Escrow funds
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Funds locked
                </span>
                <span className="text-2xl font-black tracking-tight">
                  {formatUsdc(totals.locked)}
                </span>
              </div>
              <Progress value={lockedShare} className="h-2" aria-label="Funds locked share" />
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {lockedShare}% of escrowed funds
              </p>
            </div>
            <div>
              <div className="mb-2 flex items-end justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Unlock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Funds released
                </span>
                <span className="text-2xl font-black tracking-tight">
                  {formatUsdc(totals.released)}
                </span>
              </div>
              <Progress
                value={releasedShare}
                className="h-2 [&_[data-slot=progress-indicator]]:bg-violet-500"
                aria-label="Funds released share"
              />
              <p className="mt-2 text-xs font-medium text-muted-foreground">
                {releasedShare}% paid out to contributors
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card className="rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Issues rewarded
                </CardTitle>
                <p className="mt-3 text-3xl font-black tracking-tight">{totals.rewarded}</p>
              </div>
              <span className="rounded-full bg-background p-2 ring-1 ring-border">
                <Tag className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </span>
            </CardHeader>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Contributors
                </CardTitle>
                <p className="mt-3 text-3xl font-black tracking-tight">{contributors.length}</p>
              </div>
              <span className="rounded-full bg-background p-2 ring-1 ring-border">
                <Users className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </span>
            </CardHeader>
            <CardContent className="pt-0">
              {contributors.length === 0 ? (
                <p className="text-sm text-muted-foreground">No contributors yet.</p>
              ) : (
                <AvatarGroup className="-space-x-3">
                  {visibleContributors.map((contributor) => (
                    <a
                      key={contributor.name}
                      href={githubProfileUrl(contributor.name)}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`@${contributor.name} on GitHub`}
                      className="relative rounded-full transition hover:z-10 hover:ring-2 hover:ring-primary/40"
                    >
                      <Avatar size="lg" className="ring-2 ring-background">
                        <AvatarImage src={githubAvatarUrl(contributor.name)} alt="" />
                        <AvatarFallback className="bg-foreground text-xs font-semibold text-background">
                          {contributor.name[0]?.toUpperCase() ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                    </a>
                  ))}
                </AvatarGroup>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
