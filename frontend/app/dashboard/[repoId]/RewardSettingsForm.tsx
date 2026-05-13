'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { notifySuccess, handleError } from '@/lib/notifications';

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  async function handleSave() {
    setSaving(true);
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
        setEditing(false);
        notifySuccess('Configuration Updated', 'Reward levels have been saved successfully.');
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update rewards');
      }
    } catch (e) {
      handleError(e, 'Update Rewards');
    } finally {
      setSaving(false);
    }
  }

  const actionsPortal = mounted && typeof document !== 'undefined' && document.getElementById('repo-config-actions');

  return (
    <div className="relative w-full">
      {/* Portal for Actions */}
      {actionsPortal && createPortal(
        <div className="flex items-stretch h-full">
          {editing && (
            <button
              onClick={() => {
                setLow(String(initialLow));
                setMedium(String(initialMedium));
                setHigh(String(initialHigh));
                setEditing(false);
              }}
              disabled={saving}
              className="px-4 py-2 font-mono font-black text-[10px] bg-white text-red-600 border-l-4 border-b-4 border-slate-950 hover:bg-red-50 transition-colors uppercase"
            >
              Discard
            </button>
          )}
          <button
            onClick={editing ? handleSave : () => setEditing(true)}
            disabled={saving}
            className={`px-6 py-2 font-mono font-black text-sm transition-all duration-200 border-l-4 border-b-4 border-slate-950 z-30 ${
              editing 
                ? 'bg-blue-600 text-white hover:bg-blue-700' 
                : 'bg-slate-950 text-white hover:bg-slate-800'
            }`}
          >
            {editing ? (saving ? 'WRITING...' : 'SAVE') : 'CONFIG'}
          </button>
        </div>,
        actionsPortal
      )}

      <div className="mt-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full">
          {[
            { label: 'LOW', value: low, setter: setLow, color: 'border-green-500' },
            { label: 'MEDIUM', value: medium, setter: setMedium, color: 'border-yellow-500' },
            { label: 'HIGH', value: high, setter: setHigh, color: 'border-red-500' },
          ].map((tier) => (
            <div 
              key={tier.label}
              className={`bg-white border-4 border-slate-950 p-6 transition-all ${
                editing ? 'shadow-[4px_4px_0_0_#2563eb] -translate-y-1' : 'shadow-[2px_2px_0_0_#000]'
              }`}
            >
              <div className="flex justify-between items-center mb-4">
                <span className="label-brutal text-[10px] text-slate-500 tracking-tighter">CLASS // {tier.label}</span>
                {!editing && <div className={`w-3 h-3 rounded-full ${tier.color.replace('border-', 'bg-')}`}></div>}
              </div>
              
              {editing ? (
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={tier.value}
                    onChange={(e) => tier.setter(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-950 px-4 py-3 font-mono font-black text-2xl focus:outline-none focus:bg-white focus:ring-4 ring-blue-500/10 transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">USDC</span>
                </div>
              ) : (
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black text-slate-950">{tier.value}</span>
                  <span className="text-xs font-bold text-slate-400 font-mono tracking-widest">USDC</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div className="mt-8 p-5 bg-blue-50 border-4 border-double border-blue-600 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="bg-blue-600 text-white w-6 h-6 flex items-center justify-center font-black text-xs shrink-0">!</div>
            <p className="text-[11px] font-mono font-bold text-blue-900 leading-relaxed uppercase tracking-tight">
              Protocol Update Warning: Modified reward parameters will only apply to <span className="underline decoration-2">newly discovered</span> issues. Existing escrows require manual override via CLI.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


