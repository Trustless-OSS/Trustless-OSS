'use client';

import { useState } from 'react';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

interface RetryProcessButtonProps {
  issueId: string;
  token: string;
  status: string;
  payoutStatus: string;
}

export default function RetryProcessButton({
  issueId,
  token,
  status,
  payoutStatus,
}: RetryProcessButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(payoutStatus === 'released');

  async function handleRetry() {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/issues/${issueId}/retry`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.step === 'released') {
          setDone(true);
        }
        window.location.reload(); 
      } else {
        const err = await res.json();
        alert(`Failed: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <span className="text-green-400 text-xs font-semibold">✅ Completed</span>;
  }

  if (status === 'completed' || status === 'cancelled') return null;

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-2"
    >
      {loading ? (
        'Retrying...'
      ) : (
        <>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Retry Process
        </>
      )}
    </button>
  );
}
