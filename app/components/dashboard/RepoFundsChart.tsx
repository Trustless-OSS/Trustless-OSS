'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export type RepoChartPoint = {
  name: string;
  repo: string;
  locked: number;
  released: number;
  remaining: number;
  rewarded: number;
};

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
  return (
    <div className="h-72 w-full min-h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} width={52} />
          <Tooltip content={<FundsTooltip />} />
          <Bar dataKey="released" name="Released" stackId="funds" fill="#0618a8" maxBarSize={48} />
          <Bar
            dataKey="remaining"
            name="Still locked"
            stackId="funds"
            fill="#3b82f6"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RepoRewardedChart({ points }: { points: RepoChartPoint[] }) {
  return (
    <div className="h-72 w-full min-h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={28} />
          <Tooltip content={<RewardedTooltip />} />
          <Bar
            dataKey="rewarded"
            name="Explore Bounties"
            fill="#10b981"
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
