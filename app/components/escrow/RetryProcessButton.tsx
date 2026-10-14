'use client';

import { useState } from 'react';
import { CheckCircle2, PauseCircle, RefreshCw, Send, XCircle } from 'lucide-react';
import { notifySuccess, handleError } from '@/lib/notifications';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { authHeaders, backendUrl } from '@/lib/backend';

interface RetryProcessButtonProps {
  issueId: string;
  token: string;
  status: string;
  payoutStatus: string;
}

// Each maintainer action maps to POST /api/v1/issues/{id}/<endpoint>.
// `retry` is live today; the backend must implement the rest for them to succeed.
const ACTIONS = [
  { value: 'retry', label: 'Retry', endpoint: 'retry', icon: RefreshCw },
  { value: 'release', label: 'Release', endpoint: 'release', icon: Send },
  { value: 'approve', label: 'Approve', endpoint: 'approve', icon: CheckCircle2 },
  { value: 'reject', label: 'Reject', endpoint: 'reject', icon: XCircle },
  { value: 'hold', label: 'Hold', endpoint: 'hold', icon: PauseCircle },
] as const;

export default function RetryProcessButton({
  issueId,
  token,
  status,
  payoutStatus,
}: RetryProcessButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(payoutStatus === 'released');

  async function runAction(endpoint: string, label: string) {
    setLoading(true);
    try {
      const res = await fetch(backendUrl(`/api/v1/issues/${issueId}/${endpoint}`), {
        method: 'POST',
        headers: authHeaders(token, false),
      });

      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.step === 'released' || endpoint === 'release') {
          setDone(true);
        }
        notifySuccess(`${label} triggered`, `The ${label.toLowerCase()} action was submitted.`);
        window.location.reload();
      } else {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to ${label.toLowerCase()}`);
      }
    } catch (e) {
      handleError(e, `${label} action`);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return <span className="status-badge status-completed">RELEASED</span>;
  }

  // Actions only apply while the bounty is live.
  if (status === 'completed' || status === 'cancelled') {
    return <span className="text-xs font-semibold text-muted-foreground">—</span>;
  }

  return (
    <Select
      value=""
      disabled={loading}
      onValueChange={(value) => {
        const action = ACTIONS.find((a) => a.value === value);
        if (action) void runAction(action.endpoint, action.label);
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label="Bounty actions"
        className="ml-auto w-[7.5rem] border-primary/30 bg-primary/10 font-semibold text-primary shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/15 [&_svg]:text-primary"
      >
        <SelectValue placeholder={loading ? 'Working…' : 'Actions'} />
      </SelectTrigger>
      <SelectContent align="end">
        {ACTIONS.map(({ value, label, icon: Icon }) => (
          <SelectItem key={value} value={value}>
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
