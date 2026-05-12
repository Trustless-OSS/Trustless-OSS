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
    return <span className="status-badge status-completed">RELEASED</span>;
  }

  if (status === 'completed' || status === 'cancelled') return null;

  return (
    <button
      onClick={handleRetry}
      disabled={loading}
      className="brutal-button px-3 py-1 text-[10px]"
    >
      {loading ? (
        'RETRYING...'
      ) : (
        'EXEC_RETRY'
      )}
    </button>
  );
}
