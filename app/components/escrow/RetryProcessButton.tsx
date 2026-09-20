'use client';

import { useState } from 'react';
import { notifySuccess, handleError } from '@/lib/notifications';
import LoadingLogo from '@/app/components/layout/LoadingLogo';
import Button from '@/app/components/ui/Button';
import { backendUrl } from '@/lib/backend';

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
      const res = await fetch(backendUrl(`/api/v1/issues/${issueId}/retry`), {
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
        notifySuccess('Process Triggered', 'Bounty release process has been initiated/retried.');
        window.location.reload();
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to retry process');
      }
    } catch (e) {
      handleError(e, 'Retry Process');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <span className="status-badge status-completed">RELEASED</span>;
  }

  if (status === 'completed' || status === 'cancelled') return null;

  return (
    <Button variant="solid" size="sm" onClick={handleRetry} disabled={loading}>
      {loading ? (
        <>
          <LoadingLogo size="tiny" variant="circle" />
          Retrying
        </>
      ) : (
        'Retry'
      )}
    </Button>
  );
}
