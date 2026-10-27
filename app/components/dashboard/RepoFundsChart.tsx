'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RepoChartPoint } from './activity';

const compactAmountFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

function formatUsdc(amount: number) {
  return `${amount.toLocaleString('en-US')} USDC`;
}

function FundsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RepoChartPoint }>;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-sm shadow-md ring-1 ring-foreground/10">
      <p className="font-semibold">{point.repo}</p>
      <p className="mt-1 text-muted-foreground">Locked {formatUsdc(point.locked)}</p>
      <p className="text-muted-foreground">Released {formatUsdc(point.released)}</p>
    </div>
  );
}

function RewardedTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RepoChartPoint }>;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl bg-popover px-3 py-2 text-sm shadow-md ring-1 ring-foreground/10">
      <p className="font-semibold">{point.repo}</p>
      <p className="mt-1 text-muted-foreground">Rewarded {point.rewarded}</p>
    </div>
  );
}

export default function RepoFundsChart({ points }: { points: RepoChartPoint[] }) {
  if (points.length === 0) return null;

  const chartPoints = points;
  const chartHeight = Math.max(256, chartPoints.length * 44);

  return (
    <div
      role="group"
      aria-label="Repository locked and released funds"
      className="w-full min-w-0 overflow-hidden rounded-xl bg-muted/20"
      style={{ height: chartHeight }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartPoints}
          layout="vertical"
          accessibilityLayer
          margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
        >
          <CartesianGrid vertical stroke="var(--border)" strokeDasharray="4 5" />
          <XAxis
            type="number"
            domain={[0, (max: number) => Math.max(max, 1)]}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value: number) => compactAmountFormatter.format(value)}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name)}
          />
          <Tooltip content={<FundsTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.45 }} />
          <Bar dataKey="released" name="Released" stackId="funds" fill="#8b5cf6" maxBarSize={26} />
          <Bar
            dataKey="remaining"
            name="Still locked"
            stackId="funds"
            fill="#3b82f6"
            radius={[0, 6, 6, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RepoRewardedChart({ points }: { points: RepoChartPoint[] }) {
  if (points.length === 0) return null;

  const chartPoints = points;
  const chartHeight = Math.max(256, chartPoints.length * 44);

  return (
    <div
      role="group"
      aria-label="Rewarded issues by repository"
      className="w-full min-w-0 overflow-hidden rounded-xl bg-muted/20"
      style={{ height: chartHeight }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartPoints}
          layout="vertical"
          accessibilityLayer
          margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
        >
          <CartesianGrid vertical stroke="var(--border)" strokeDasharray="4 5" />
          <XAxis
            type="number"
            domain={[0, (max: number) => Math.max(max, 1)]}
            allowDecimals={false}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={96}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(name: string) => (name.length > 14 ? `${name.slice(0, 13)}…` : name)}
          />
          <Tooltip content={<RewardedTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.45 }} />
          <Bar
            dataKey="rewarded"
            name="Explore Bounties"
            fill="#10b981"
            radius={[0, 6, 6, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
