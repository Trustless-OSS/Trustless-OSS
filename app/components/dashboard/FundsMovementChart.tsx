'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
} from 'recharts';
import { ArrowUpRight, ChartNoAxesCombined, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  completeFundsMovementSeries,
  fetchFundsMovement,
  type FundsMovementPoint,
} from '@/lib/dashboard-api';
import styles from './dashboard.module.css';

const TVL_COLOR = '#2563eb';
const PAYOUTS_COLOR = '#8b5cf6';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export default function FundsMovementChart() {
  const [data, setData] = React.useState<FundsMovementPoint[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const isCompact = useCompactChart();

  React.useEffect(() => {
    let active = true;
    fetchFundsMovement()
      .then((points) => active && setData(points))
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Failed to load funds movement.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const chartData = data === null ? null : completeFundsMovementSeries(data, data.at(-1)?.tvl ?? 0);
  const currentPoint = chartData?.at(-1);
  const currentMonthLabel = currentPoint
    ? `${currentPoint.month} ${currentPoint.period.slice(0, 4)}`
    : '';

  return (
    <section className="mt-10" aria-labelledby="funds-movement-title">
      <div className={styles.sectionIntro}>
        <div className={styles.sectionIntroRow}>
          <div>
            <h2 id="funds-movement-title" className={styles.sectionTitle}>
              Funds movement
            </h2>
          </div>
          <Badge variant="outline" className="h-auto rounded-full px-3 py-1.5 text-[0.68rem]">
            Rolling 12 months
          </Badge>
        </div>
      </div>

      <Card className={`${styles.chartCard} ${styles.revealCard}`}>
        <CardHeader className="flex flex-col gap-5 border-b border-border/70 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="inline-flex items-center gap-2 font-display text-lg font-extrabold tracking-tight sm:text-xl">
              <ChartNoAxesCombined className="h-5 w-5 text-primary" aria-hidden="true" />
              Escrow performance
            </CardTitle>
          </div>

          {currentPoint ? (
            <div className="grid grid-cols-2 gap-2 sm:min-w-72">
              <div className="rounded-lg bg-primary/8 px-3 py-2.5 ring-1 ring-primary/15">
                <p className="flex items-center gap-1.5 text-[0.62rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  <Wallet className="size-3 text-primary" aria-hidden="true" /> TVL
                </p>
                <p className="mt-1 font-mono text-sm font-black sm:text-base">
                  {compactCurrencyFormatter.format(currentPoint.tvl)}
                </p>
              </div>
              <div className="rounded-lg bg-violet-500/8 px-3 py-2.5 ring-1 ring-violet-500/15">
                <p className="flex items-center gap-1.5 text-[0.62rem] font-semibold tracking-wide text-muted-foreground uppercase">
                  <ArrowUpRight className="size-3 text-violet-500" aria-hidden="true" /> Paid
                </p>
                <p className="mt-1 font-mono text-sm font-black sm:text-base">
                  {compactCurrencyFormatter.format(currentPoint.payouts)}
                </p>
              </div>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="pt-5">
          <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span
                className="inline-block size-2.5 rounded-full bg-[#2563eb]"
                aria-hidden="true"
              />
              Escrow TVL locked
            </div>
            <div className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span
                className="inline-block size-2.5 rounded-full bg-[#8b5cf6]"
                aria-hidden="true"
              />
              Payouts released
            </div>
            {currentPoint ? (
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
                {currentMonthLabel}
              </div>
            ) : null}
          </div>
          <div className="h-[clamp(18rem,42vw,25rem)] min-h-72 w-full min-w-0">
            {error ? (
              <p
                role="alert"
                className="flex h-full items-center justify-center text-sm font-medium text-destructive"
              >
                {error}
              </p>
            ) : chartData == null ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  accessibilityLayer
                  margin={{ top: 12, right: 4, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fundsTvlFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={TVL_COLOR} stopOpacity={0.24} />
                      <stop offset="95%" stopColor={TVL_COLOR} stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="fundsPayoutsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={PAYOUTS_COLOR} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={PAYOUTS_COLOR} stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="4 5" />
                  <XAxis
                    dataKey="period"
                    tickFormatter={(period: string) =>
                      chartData.find((point) => point.period === period)?.month ?? period
                    }
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    minTickGap={18}
                  />
                  <YAxis
                    yAxisId="left"
                    domain={[0, (max: number) => Math.max(max, 1)]}
                    width={isCompact ? 40 : 52}
                    tick={{ fontSize: isCompact ? 9 : 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => compactCurrencyFormatter.format(value)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    domain={[0, (max: number) => Math.max(max, 1)]}
                    hide={isCompact}
                    width={isCompact ? 0 : 52}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value: number) => compactCurrencyFormatter.format(value)}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      boxShadow: '0 8px 24px rgb(0 0 0 / 12%)',
                    }}
                    labelStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                    itemStyle={{ fontSize: 12 }}
                    formatter={(value, name) => [currencyFormatter.format(Number(value)), name]}
                  />
                  {currentPoint ? (
                    <>
                      <ReferenceLine
                        x={currentPoint.period}
                        stroke="var(--muted-foreground)"
                        strokeDasharray="3 5"
                        strokeOpacity={0.55}
                      />
                      <ReferenceDot
                        x={currentPoint.period}
                        y={currentPoint.tvl}
                        yAxisId="left"
                        r={9}
                        fill="transparent"
                        stroke="none"
                        shape={(props) => (
                          <g
                            transform={`translate(${props.cx ?? 0}, ${props.cy ?? 0})`}
                            aria-label={`Current month escrow TVL: ${currencyFormatter.format(currentPoint.tvl)}`}
                          >
                            <circle className="chart-live-point__pulse" r={7} fill={TVL_COLOR} />
                            <circle
                              r={4}
                              fill={TVL_COLOR}
                              stroke="var(--background)"
                              strokeWidth={2}
                            />
                          </g>
                        )}
                      />
                      <ReferenceDot
                        x={currentPoint.period}
                        y={currentPoint.payouts}
                        yAxisId="right"
                        r={9}
                        fill="transparent"
                        stroke="none"
                        shape={(props) => (
                          <g
                            transform={`translate(${props.cx ?? 0}, ${props.cy ?? 0})`}
                            aria-label={`Current month payouts released: ${currencyFormatter.format(currentPoint.payouts)}`}
                          >
                            <circle
                              className="chart-live-point__pulse"
                              r={7}
                              fill={PAYOUTS_COLOR}
                            />
                            <circle
                              r={4}
                              fill={PAYOUTS_COLOR}
                              stroke="var(--background)"
                              strokeWidth={2}
                            />
                          </g>
                        )}
                      />
                    </>
                  ) : null}
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="tvl"
                    name="Escrow TVL locked"
                    stroke={TVL_COLOR}
                    fill="url(#fundsTvlFill)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="payouts"
                    name="Payouts released"
                    stroke={PAYOUTS_COLOR}
                    fill="url(#fundsPayoutsFill)"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 5, strokeWidth: 0 }}
                    isAnimationActive
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function useCompactChart() {
  const [isCompact, setIsCompact] = React.useState(false);

  React.useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;

    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setIsCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return isCompact;
}
