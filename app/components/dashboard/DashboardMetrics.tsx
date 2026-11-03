'use client';

import { useEffect, useState } from 'react';
import { CircleCheck, Lock, LockKeyhole, Unlock, UsersRound, Wallet } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDeployedEscrowBalance } from '@/lib/dashboard-api';
import {
  formatUsdc,
  githubAvatarUrl,
  githubProfileUrl,
  listContributors,
  summarizeCurrentlyLocked,
  summarizeActivity,
} from '@/app/components/dashboard/activity';
import { useActivity } from '@/app/components/dashboard/useActivity';
import styles from './dashboard.module.css';

export default function DashboardMetrics() {
  const { data, loading, error } = useActivity();
  const [escrowBalance, setEscrowBalance] = useState<number | null>(null);
  const [escrowBalanceError, setEscrowBalanceError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchDeployedEscrowBalance()
      .then((balance) => active && setEscrowBalance(balance))
      .catch((reason: unknown) => {
        if (active) {
          setEscrowBalanceError(
            reason instanceof Error ? reason.message : 'Failed to load deployed escrow balances.'
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (error || escrowBalanceError) {
    return (
      <p className="mb-6 rounded-xl border border-border bg-card px-6 py-4 text-sm font-medium text-destructive">
        {error ?? escrowBalanceError}
      </p>
    );
  }
  if (loading || escrowBalance === null) {
    return <Skeleton className="mb-6 h-56 w-full rounded-xl" />;
  }

  const rows = data ?? [];
  const totals = summarizeActivity(rows);
  const currentlyLocked = summarizeCurrentlyLocked(rows);
  const contributors = listContributors(rows);
  const visibleContributors = contributors.slice(0, 6); // Show only 6 contributors
  const lockedInEscrow = Math.min(currentlyLocked, escrowBalance);
  const lockedShare = escrowBalance === 0 ? 0 : Math.round((lockedInEscrow / escrowBalance) * 100);
  const releasedTotal = escrowBalance + totals.released;
  const releasedShare =
    releasedTotal === 0 ? 0 : Math.round((totals.released / releasedTotal) * 100);

  return (
    <section className="mb-6" aria-labelledby="escrow-overview-title">
      <div className={styles.sectionIntro}>
        <div className={styles.sectionIntroRow}>
          <div>
            <h2 id="escrow-overview-title" className={styles.sectionTitle}>
              Escrow overview
            </h2>
          </div>
          <Badge variant="outline" className="h-auto gap-2 rounded-full px-3 py-1.5 text-[0.68rem]">
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
            Live
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className={`${styles.revealCard} rounded-xl xl:col-span-7`}>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                Escrow funds
              </CardTitle>
            </div>
            <span className={styles.metricIcon}>
              <Wallet aria-hidden="true" />
            </span>
          </CardHeader>
          <CardContent className="space-y-8">
            <div className="rounded-lg bg-muted/40 p-4 sm:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Lock className="h-4 w-4 text-blue-500" aria-hidden="true" />
                  Total Balance
                </span>
                <span className={styles.metricValue}>{formatUsdc(escrowBalance)}</span>
              </div>
              <div
                role="img"
                aria-label={`Escrow balance: ${formatUsdc(escrowBalance)} held, including ${formatUsdc(lockedInEscrow)} currently locked`}
                className={`${styles.progressGlow} relative h-2.5 w-full rounded-full bg-blue-500`}
              >
                <span
                  className="absolute inset-y-0 right-0 bg-violet-500"
                  style={{ width: `${lockedShare}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" aria-hidden="true" />
                  Total held: {formatUsdc(escrowBalance)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-violet-500" aria-hidden="true" />
                  Currently locked: {formatUsdc(lockedInEscrow)}
                </span>
              </div>
            </div>
            <div>
              <div className="mb-3 flex items-end justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Unlock className="h-4 w-4 text-violet-500" aria-hidden="true" />
                  Funds released
                </span>
                <span className="font-mono text-2xl font-black tracking-tight sm:text-3xl">
                  {formatUsdc(totals.released)}
                </span>
              </div>
              <Progress
                value={releasedShare}
                className="h-2 [&_[data-slot=progress-indicator]]:bg-violet-500"
                aria-label="Funds released share"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:col-span-5">
          <Card className={`${styles.revealCard} ${styles.delayOne} rounded-xl`}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Issues rewarded
                </CardTitle>
                <p className="mt-4 font-mono text-4xl font-black tracking-[-0.08em]">
                  {totals.rewarded}
                </p>
              </div>
              <span className={styles.metricIcon}>
                <CircleCheck aria-hidden="true" />
              </span>
            </CardHeader>
          </Card>

          <Card className={`${styles.revealCard} ${styles.delayTwo} rounded-xl`}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Contributors
                </CardTitle>
                <p className="mt-4 font-mono text-4xl font-black tracking-[-0.08em]">
                  {contributors.length}
                </p>
              </div>
              <span className={styles.metricIcon}>
                <UsersRound aria-hidden="true" />
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

          <Card className={`${styles.revealCard} ${styles.delayThree} rounded-xl sm:col-span-2`}>
            <CardContent className="flex flex-col justify-between gap-5 pt-5 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className={styles.metricIcon}>
                  <LockKeyhole aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-bold">Locked for rewards</p>
                </div>
              </div>
              <Badge className="h-auto self-start rounded-full bg-primary/10 px-3 py-1.5 text-primary hover:bg-primary/10 sm:self-center">
                {formatUsdc(lockedInEscrow)} locked
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
