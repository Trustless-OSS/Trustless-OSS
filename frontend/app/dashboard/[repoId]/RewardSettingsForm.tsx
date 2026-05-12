'use client';

import { useState } from 'react';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

interface RewardSettingsFormProps {
  repoId: string;
  token: string;
  initialLow: number;
  initialMedium: number;
  initialHigh: number;
}

export default function RewardSettingsForm({
  repoId,
  token,
  initialLow,
  initialMedium,
  initialHigh,
}: RewardSettingsFormProps) {
  const [low, setLow] = useState(String(initialLow));
  const [medium, setMedium] = useState(String(initialMedium));
  const [high, setHigh] = useState(String(initialHigh));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`${BACKEND}/api/repos/${repoId}/rewards`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reward_low: parseFloat(low) || 0,
          reward_medium: parseFloat(medium) || 0,
          reward_high: parseFloat(high) || 0,
        }),
      });

      if (res.ok) {
        setSaved(true);
        setEditing(false);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error('Failed to update rewards:', e);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex gap-4 mt-6 pt-6 border-t-4 border-slate-950 border-dashed flex-wrap items-end">
        <div className="bg-slate-200 border-2 border-slate-950 px-4 py-3 shadow-[4px_4px_0_0_#2563eb]">
          <div className="label-brutal text-slate-500 mb-1">CLASS // LOW</div>
          <div className="text-sm font-mono font-black text-slate-950">{low} USDC</div>
        </div>
        <div className="bg-slate-200 border-2 border-slate-950 px-4 py-3 shadow-[4px_4px_0_0_#2563eb]">
          <div className="label-brutal text-slate-500 mb-1">CLASS // MEDIUM</div>
          <div className="text-sm font-mono font-black text-slate-950">{medium} USDC</div>
        </div>
        <div className="bg-slate-200 border-2 border-slate-950 px-4 py-3 shadow-[4px_4px_0_0_#2563eb]">
          <div className="label-brutal text-slate-500 mb-1">CLASS // HIGH</div>
          <div className="text-sm font-mono font-black text-slate-950">{high} USDC</div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="brutal-button-outline px-4 py-3 text-xs"
        >
          EDIT_REWARDS
        </button>
        {saved && (
          <span className="text-blue-600 font-bold font-mono text-sm uppercase animate-pulse border-2 border-blue-600 px-2 py-1">✓ CONFIG_SAVED</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t-4 border-slate-950 border-dashed">
      <div className="label-brutal text-slate-500 mb-4">CONFIG_INPUT // REWARD_LEVELS_USDC</div>
      <div className="flex gap-4 flex-wrap items-end">
        <div>
          <label className="label-brutal block text-slate-950 mb-1">CLASS // LOW</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={low}
            onChange={(e) => setLow(e.target.value)}
            className="w-24 px-3 py-2 border-4 border-slate-950 bg-white text-slate-950 text-sm font-mono font-bold focus:outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label className="label-brutal block text-slate-950 mb-1">CLASS // MEDIUM</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            className="w-24 px-3 py-2 border-4 border-slate-950 bg-white text-slate-950 text-sm font-mono font-bold focus:outline-none focus:border-blue-600"
          />
        </div>
        <div>
          <label className="label-brutal block text-slate-950 mb-1">CLASS // HIGH</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={high}
            onChange={(e) => setHigh(e.target.value)}
            className="w-24 px-3 py-2 border-4 border-slate-950 bg-white text-slate-950 text-sm font-mono font-bold focus:outline-none focus:border-blue-600"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="brutal-button px-4 py-2 text-xs"
          >
            {saving ? 'SAVING...' : 'CONFIRM_WRITE'}
          </button>
          <button
            onClick={() => {
              setLow(String(initialLow));
              setMedium(String(initialMedium));
              setHigh(String(initialHigh));
              setEditing(false);
            }}
            className="brutal-button-outline px-4 py-2 text-xs"
          >
            ABORT
          </button>
        </div>
      </div>
      <div className="terminal-block mt-6 max-w-2xl">
        <span className="text-slate-500">// Custom bounty assignment override</span><br />
        <span className="text-blue-400">@Trustless-OSS</span> <span className="text-yellow-200">50</span>
      </div>
    </div>
  );
}
