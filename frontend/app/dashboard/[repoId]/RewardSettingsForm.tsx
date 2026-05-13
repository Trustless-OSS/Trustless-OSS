'use client';

import { useState } from 'react';
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

  return (
    <div className="relative">
      {/* Top-right Toggle/Save Button */}
      <button
        onClick={editing ? handleSave : () => setEditing(true)}
        disabled={saving}
        className={`absolute -top-[116px] -right-[32px] md:-top-[132px] md:-right-[48px] px-6 py-2 font-mono font-black text-sm transition-all duration-200 border-b-4 border-l-4 border-slate-950 z-30 ${
          editing 
            ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-[4px_4px_0_0_#000]' 
            : 'bg-slate-950 text-white hover:bg-slate-800'
        }`}
      >
        {editing ? (saving ? 'WRITING...' : 'SAVE_CHANGES') : 'CONFIG_REWARDS'}
      </button>

      <div className="mt-4">
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
            {[
              { label: 'LOW', value: low, setter: setLow, color: 'border-green-500' },
              { label: 'MEDIUM', value: medium, setter: setMedium, color: 'border-yellow-500' },
              { label: 'HIGH', value: high, setter: setHigh, color: 'border-red-500' },
            ].map((tier) => (
              <div 
                key={tier.label}
                className={`bg-white border-4 border-slate-950 p-4 transition-all ${
                  editing ? 'shadow-[4px_4px_0_0_#2563eb]' : 'shadow-[2px_2px_0_0_#000]'
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="label-brutal text-[10px] text-slate-500 tracking-tighter">CLASS // {tier.label}</span>
                  {!editing && <div className={`w-2 h-2 rounded-full ${tier.color.replace('border-', 'bg-')}`}></div>}
                </div>
                
                {editing ? (
                  <div className="relative">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={tier.value}
                      onChange={(e) => tier.setter(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-950 px-3 py-2 font-mono font-black text-lg focus:outline-none focus:bg-white focus:ring-2 ring-blue-500/20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">USDC</span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-slate-950">{tier.value}</span>
                    <span className="text-xs font-bold text-slate-500 font-mono tracking-widest">USDC</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {editing && (
            <button
              onClick={() => {
                setLow(String(initialLow));
                setMedium(String(initialMedium));
                setHigh(String(initialHigh));
                setEditing(false);
              }}
              className="px-4 py-2 text-[10px] font-black font-mono text-red-600 hover:bg-red-50 border-2 border-red-600 uppercase transition-colors whitespace-nowrap mt-2 md:mt-0"
            >
              Cancel
            </button>
          )}
        </div>

        {editing && (
          <div className="mt-6 p-4 bg-blue-50 border-2 border-dashed border-blue-600 flex items-start gap-3">
            <div className="text-blue-600 mt-0.5 font-bold">!</div>
            <p className="text-[11px] font-mono font-bold text-blue-800 leading-tight">
              NOTE: UPDATING THESE VALUES WILL ONLY AFFECT <span className="underline">NEW</span> ISSUES. 
              EXISTING BOUNTIES MUST BE MANUALLY OVERRIDDEN VIA THE GITHUB COMMAND INTERFACE.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

