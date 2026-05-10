'use client';

import { useState } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

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
      <div className="flex gap-4 mt-6 pt-6 border-t border-white/5 flex-wrap items-end">
        <div className="glass rounded-xl px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">🟢 Low</div>
          <div className="text-sm font-mono font-semibold text-white">{low} USDC</div>
        </div>
        <div className="glass rounded-xl px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">🟡 Medium</div>
          <div className="text-sm font-mono font-semibold text-white">{medium} USDC</div>
        </div>
        <div className="glass rounded-xl px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">🔴 High</div>
          <div className="text-sm font-mono font-semibold text-white">{high} USDC</div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs transition-all border border-white/5"
        >
          ✏️ Edit Rewards
        </button>
        {saved && (
          <span className="text-green-400 text-xs animate-pulse">✓ Saved!</span>
        )}
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-white/5">
      <div className="text-sm font-medium text-gray-300 mb-3">Configure Reward Levels (USDC)</div>
      <div className="flex gap-4 flex-wrap items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">🟢 Low</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={low}
            onChange={(e) => setLow(e.target.value)}
            className="w-24 px-3 py-2 rounded-lg bg-gray-800 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">🟡 Medium</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={medium}
            onChange={(e) => setMedium(e.target.value)}
            className="w-24 px-3 py-2 rounded-lg bg-gray-800 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">🔴 High</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={high}
            onChange={(e) => setHigh(e.target.value)}
            className="w-24 px-3 py-2 rounded-lg bg-gray-800 border border-white/10 text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => {
              setLow(String(initialLow));
              setMedium(String(initialMedium));
              setHigh(String(initialHigh));
              setEditing(false);
            }}
            className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs transition-all border border-white/5"
          >
            Cancel
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-3">
        💡 You can also tag <code className="text-indigo-400">@Trustless-OSS 50</code> in any issue comment to create a custom bounty amount.
      </p>
    </div>
  );
}
