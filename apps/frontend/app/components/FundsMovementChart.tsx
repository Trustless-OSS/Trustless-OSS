'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { createClient } from '@/lib/supabase/client';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

interface ChartItem {
  month: string;
  tvl: number;
  payouts: number;
}

interface FundsMovementChartProps {
  initialToken?: string;
  data?: ChartItem[] | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function FundsMovementChart({
  initialToken,
  data: propData,
  loading: propLoading,
  error: propError,
  onRetry,
}: FundsMovementChartProps) {
  const [internalData, setInternalData] = useState<ChartItem[] | null>(null);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const isExternal = propData !== undefined || propLoading !== undefined || propError !== undefined;

  const data = isExternal ? propData : internalData;
  const loading = isExternal ? propLoading : internalLoading;
  const error = isExternal ? propError : internalError;

  const fetchChartData = useCallback(async () => {
    if (isExternal) {
      if (onRetry) onRetry();
      return;
    }
    setInternalLoading(true);
    setInternalError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = initialToken ?? session?.access_token ?? undefined;

      if (!token) {
        throw new Error('No authentication session found');
      }

      const res = await fetch(`${BACKEND}/api/dashboard/overview`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP error ${res.status}`);
      }

      const json = await res.json();
      setInternalData(json.chartData);
    } catch (err: unknown) {
      setInternalError(err instanceof Error ? err.message : 'Failed to load chart data');
    } finally {
      setInternalLoading(false);
    }
  }, [isExternal, onRetry, initialToken]);

  useEffect(() => {
    setMounted(true);
    if (!isExternal) {
      fetchChartData();
    }
  }, [isExternal, fetchChartData]);

  if (!mounted || loading) {
    return (
      <div className="bg-white brutal-border p-6 brutal-shadow mb-12" data-testid="chart-loading">
        <div className="flex justify-between items-center mb-6">
          <div className="h-6 w-48 bg-slate-200 brutal-border border-2 animate-pulse-brutal"></div>
          <div className="h-4 w-32 bg-slate-200 brutal-border border-2 animate-pulse-brutal"></div>
        </div>
        <div className="h-[300px] w-full bg-slate-100 brutal-border border-2 animate-pulse-brutal flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 font-mono text-xs font-bold text-slate-400 uppercase">
            <RefreshCw className="animate-spin" size={24} />
            LOADING_ANALYTICS_LEDGER...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="bg-white brutal-border p-6 brutal-shadow mb-12 flex flex-col gap-4"
        data-testid="chart-error"
      >
        <div className="flex items-center gap-4">
          <div className="label-brutal bg-red-500 text-white px-2 py-1 border-2 border-slate-950">
            ERR_CHART
          </div>
          <h2 className="title-brutal text-xl text-slate-950">Failed to load analytics chart</h2>
        </div>
        <p className="text-xs text-slate-600 font-mono bg-white p-2 border-2 border-slate-950">
          {error}
        </p>
        <button
          onClick={fetchChartData}
          className="brutal-button bg-slate-950 text-white px-4 py-2 text-xs w-fit flex items-center gap-2 cursor-pointer"
          data-testid="chart-retry-btn"
        >
          <RefreshCw size={14} />
          RETRY_CHART_FETCH
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div
        className="bg-white brutal-border p-6 brutal-shadow mb-12 text-center py-16"
        data-testid="chart-empty"
      >
        <div className="text-4xl mb-4 grayscale">📊</div>
        <h2 className="title-brutal text-2xl text-slate-950 mb-2">NO_ANALYTICS_RECORD</h2>
        <p className="text-slate-500 font-mono font-bold uppercase text-xs">
          No historical escrow or payout movements recorded yet.
        </p>
      </div>
    );
  }

  // Format tooltip & tick labels
  const formatYAxis = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      compactDisplay: 'short',
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div
      className="bg-white brutal-border p-6 brutal-shadow mb-12 flex flex-col h-full"
      data-testid="chart-container"
    >
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b-4 border-slate-950 pb-4">
        <div>
          <h2 className="title-brutal text-2xl text-slate-950 flex items-center gap-2">
            <TrendingUp size={24} className="text-blue-600" />
            FUNDS_MOVEMENT_LEDGER_
          </h2>
          <p className="text-[10px] text-slate-500 font-mono font-bold uppercase mt-1">
            Historical analytics comparing TVL and released payouts
          </p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase">
            <span className="w-3 h-3 bg-[#06b6d4] border border-slate-950 inline-block"></span>
            TVL
          </div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase">
            <span className="w-3 h-3 bg-[#8b5cf6] border border-slate-950 inline-block"></span>
            PAYOUTS
          </div>
        </div>
      </div>

      <div
        className="w-full h-[350px]"
        aria-label="Historical funds movement analytics showing TVL and payouts released."
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="month"
              stroke="#020617"
              fontSize={11}
              fontWeight={800}
              tickLine={true}
              fontFamily="var(--font-mono)"
            />
            {/* Dual Y-Axes */}
            <YAxis
              yAxisId="left"
              stroke="#06b6d4"
              fontSize={10}
              fontWeight={800}
              fontFamily="var(--font-mono)"
              tickFormatter={formatYAxis}
              label={{
                value: 'ESCROW TVL LOCKED ($)',
                angle: -90,
                position: 'insideLeft',
                offset: 10,
                fontSize: 9,
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                fill: '#06b6d4',
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#8b5cf6"
              fontSize={10}
              fontWeight={800}
              fontFamily="var(--font-mono)"
              tickFormatter={formatYAxis}
              label={{
                value: 'PAYOUTS RELEASED ($)',
                angle: 90,
                position: 'insideRight',
                offset: 15,
                fontSize: 9,
                fontWeight: 900,
                fontFamily: 'var(--font-mono)',
                fill: '#8b5cf6',
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '4px solid #020617',
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#020617',
                boxShadow: '4px 4px 0px 0px #020617',
              }}
              formatter={(value: number | string | Array<number | string>, name: string) => [
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(Number(value)),
                name === 'tvl' ? 'ESCROW TVL' : 'PAYOUTS RELEASED',
              ]}
              labelFormatter={(label) => `MONTH: ${label}`}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="tvl"
              name="tvl"
              stroke="#06b6d4"
              strokeWidth={3}
              activeDot={{ r: 8, stroke: '#020617', strokeWidth: 2 }}
              dot={{ r: 4, stroke: '#06b6d4', strokeWidth: 2, fill: '#ffffff' }}
              animationDuration={800}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="payouts"
              name="payouts"
              stroke="#8b5cf6"
              strokeWidth={3}
              activeDot={{ r: 8, stroke: '#020617', strokeWidth: 2 }}
              dot={{ r: 4, stroke: '#8b5cf6', strokeWidth: 2, fill: '#ffffff' }}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
