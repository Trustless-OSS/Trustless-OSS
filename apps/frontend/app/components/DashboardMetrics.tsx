'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lock, Shield, Users, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

interface MetricsData {
  tvl: number;
  tvlChange: number;
  activePools: number;
  totalPools: number;
  contributorsCount: number;
}

interface DashboardMetricsProps {
  initialToken?: string;
}

export default function DashboardMetrics({ initialToken }: DashboardMetricsProps) {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let token = initialToken;
      if (!token) {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        token = session?.access_token ?? undefined;
      }

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
      setData(json);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, [initialToken]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="grid md:grid-cols-3 gap-8 mb-12" data-testid="metrics-loading">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white brutal-border p-6 brutal-shadow animate-pulse-brutal min-h-[160px] flex flex-col justify-between"
          >
            <div className="flex justify-between items-center mb-4">
              <div className="h-4 w-28 bg-slate-200 brutal-border border-2"></div>
              <div className="h-6 w-6 bg-slate-200 brutal-border border-2"></div>
            </div>
            <div className="h-8 w-20 bg-slate-300 brutal-border border-2 mb-2"></div>
            <div className="h-4 w-32 bg-slate-200 brutal-border border-2"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mb-12 p-6 bg-red-100 brutal-border flex flex-col gap-4 brutal-shadow"
        data-testid="metrics-error"
      >
        <div className="flex items-center gap-4">
          <div className="label-brutal bg-red-500 text-white px-2 py-1 border-2 border-slate-950">
            ERR_OVERVIEW
          </div>
          <p className="font-bold text-slate-950 uppercase tracking-widest text-sm">
            Failed to load metrics data
          </p>
        </div>
        <p className="text-xs text-slate-600 font-mono bg-white p-2 border-2 border-slate-950">
          {error}
        </p>
        <button
          onClick={fetchMetrics}
          className="brutal-button bg-slate-950 text-white px-4 py-2 text-xs w-fit flex items-center gap-2 cursor-pointer"
          data-testid="metrics-retry-btn"
        >
          <RefreshCw size={14} />
          RETRY_FETCH
        </button>
      </div>
    );
  }

  if (!data) return null;

  // Format TVL
  const formattedTvl = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(data.tvl);

  // Active pool percentage calculation
  const poolPercentage =
    data.totalPools > 0 ? Math.round((data.activePools / data.totalPools) * 100) : 0;

  return (
    <div className="grid md:grid-cols-3 gap-8 mb-12" data-testid="metrics-container">
      {/* CARD 1: TOTAL VALUE LOCKED */}
      <div
        className="bg-white brutal-border p-6 flex flex-col justify-between brutal-shadow h-full relative"
        data-testid="card-tvl"
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="label-brutal text-slate-500 mb-1">TOTAL_VALUE_LOCKED</div>
            <div className="text-3xl font-black font-mono text-slate-950">{formattedTvl}</div>
          </div>
          <div className="w-10 h-10 bg-slate-950 text-white flex items-center justify-center border-2 border-slate-950">
            <Lock size={20} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="tvl-change-badge"
            className={`font-mono font-bold text-xs uppercase px-2 py-0.5 border-2 border-slate-950 ${
              data.tvlChange >= 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
            }`}
          >
            {data.tvlChange >= 0 ? `+${data.tvlChange}%` : `${data.tvlChange}%`}
          </span>
          <span className="text-[10px] text-slate-500 font-mono font-bold uppercase">
            vs previous month
          </span>
        </div>
      </div>

      {/* CARD 2: ACTIVE SMART POOLS */}
      <div
        className="bg-white brutal-border p-6 flex flex-col justify-between brutal-shadow h-full relative"
        data-testid="card-pools"
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="label-brutal text-slate-500 mb-1">ACTIVE_SMART_POOLS</div>
            <div className="text-3xl font-black font-mono text-slate-950">
              {data.activePools}{' '}
              <span className="text-sm font-bold text-slate-500">/ {data.totalPools}</span>
            </div>
          </div>
          <div className="w-10 h-10 bg-slate-950 text-white flex items-center justify-center border-2 border-slate-950">
            <Shield size={20} />
          </div>
        </div>
        <div>
          <div className="w-full bg-slate-200 h-3 border-2 border-slate-950 mb-2 overflow-hidden">
            <div
              data-testid="pool-progress-bar"
              className="bg-blue-600 h-full border-r-2 border-slate-950"
              style={{ width: `${poolPercentage}%` }}
            ></div>
          </div>
          <div className="text-[10px] text-slate-500 font-mono font-bold uppercase">
            {poolPercentage}% active pools configured
          </div>
        </div>
      </div>

      {/* CARD 3: DEV CONTRIBUTORS */}
      <div
        className="bg-white brutal-border p-6 flex flex-col justify-between brutal-shadow h-full relative"
        data-testid="card-contributors"
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="label-brutal text-slate-500 mb-1">DEV_CONTRIBUTORS</div>
            <div className="text-3xl font-black font-mono text-slate-950">
              {data.contributorsCount}
            </div>
          </div>
          <div className="w-10 h-10 bg-slate-950 text-white flex items-center justify-center border-2 border-slate-950">
            <Users size={20} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="status-badge status-completed py-0.5 text-[10px]"
            data-testid="contributor-status"
          >
            Whitelisted OAuth Verified
          </span>
        </div>
      </div>
    </div>
  );
}
