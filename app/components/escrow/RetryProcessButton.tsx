'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, PauseCircle, RefreshCw, Send, X, XCircle } from 'lucide-react';
import { notifySuccess, handleError, toast } from '@/lib/notifications';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Portal from '@/app/components/layout/Portal';
import LoadingLogo from '@/app/components/layout/LoadingLogo';
import Button from '@/app/components/ui/Button';
import { authHeaders, backendUrl } from '@/lib/backend';

interface RetryProcessButtonProps {
  issueId: string; // bounty UUID — NOT the GitHub issue number
  token: string;
  status: string;
  milestoneIndex: number | null; // on-chain milestone; null when not pushed to escrow
}

// Each maintainer action maps to POST /api/v1/issues/{id}/<endpoint>.
// `retry` is live today; the backend must implement the rest for them to succeed.
const ACTIONS = [
  { value: 'retry', label: 'Retry', endpoint: 'retry', icon: RefreshCw },
  { value: 'release', label: 'Release', endpoint: 'release', icon: Send },
  { value: 'approve', label: 'Approve', endpoint: 'approve', icon: CheckCircle2 },
  { value: 'hold', label: 'Hold', endpoint: 'hold', icon: PauseCircle },
  { value: 'reject', label: 'Reject', endpoint: 'reject', icon: XCircle },
] as const;

type Confirm = 'hold' | 'reject';

export default function RetryProcessButton({
  issueId,
  token,
  status,
  milestoneIndex,
}: RetryProcessButtonProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const router = useRouter();

  const normalized = status.trim().toLowerCase();
  const isTerminal =
    normalized === 'paid' || normalized === 'cancelled' || normalized === 'canceled';
  const onChain = milestoneIndex !== null;

  // Hide hold/reject for terminal bounties; hide hold when not pushed on-chain.
  const actions = ACTIONS.filter((a) => {
    if (a.value === 'hold') return !isTerminal && onChain;
    if (a.value === 'reject') return !isTerminal;
    return true;
  });

  async function runAction(endpoint: string, label: string) {
    setLoading(true);
    try {
      const res = await fetch(backendUrl(`/api/v1/issues/${issueId}/${endpoint}`), {
        method: 'POST',
        headers: authHeaders(token, false),
      });

      if (res.status === 401) {
        router.push('/login');
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Show the backend message verbatim; handleError's sanitizer would otherwise
        // mask specific 400s (e.g. "bad request") behind a generic phrase.
        const message =
          res.status === 403
            ? 'Only repository maintainers can perform this action.'
            : res.status === 404
              ? 'Bounty not found.'
              : (data.error ?? `Failed to ${label.toLowerCase()}`);
        toast.error(`${label} action`, { description: message, duration: 5000 });
        return;
      }

      if (endpoint === 'hold') {
        notifySuccess('Bounty placed on hold.');
      } else if (endpoint === 'reject') {
        const refunded = data.refundedAmount ?? '0';
        notifySuccess(`Bounty rejected. ${refunded} USDC returned to the escrow pool.`);
      } else {
        if (data.step === 'released' || endpoint === 'release') setDone(true);
        notifySuccess(`${label} triggered`, `The ${label.toLowerCase()} action was submitted.`);
      }
      setConfirm(null);
      router.refresh();
    } catch (e) {
      handleError(e, `${label} action`);
    } finally {
      setLoading(false);
    }
  }

  function closeModal() {
    if (loading) return;
    setConfirm(null);
  }

  if (done) {
    return <span className="status-badge status-completed">RELEASED</span>;
  }

  const isDisabled = loading || normalized === 'completed' || isTerminal;

  return (
    <>
      <Select
        value=""
        disabled={isDisabled}
        onValueChange={(value) => {
          const action = actions.find((a) => a.value === value);
          if (!action) return;
          if (action.value === 'hold' || action.value === 'reject') {
            setConfirm(action.value);
          } else {
            void runAction(action.endpoint, action.label);
          }
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label="Bounty actions"
          className={`ml-auto w-[7.5rem] font-semibold shadow-sm transition-colors [&_svg]:text-primary ${
            isDisabled
              ? 'border-border/50 bg-muted text-muted-foreground opacity-50 cursor-not-allowed'
              : 'border-primary/30 bg-primary/10 text-primary hover:border-primary/50 hover:bg-primary/15'
          }`}
        >
          <SelectValue placeholder={loading ? 'Working…' : 'Actions'} />
        </SelectTrigger>
        <SelectContent align="end">
          {actions.map(({ value, label, icon: Icon }) => (
            <SelectItem key={value} value={value}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {confirm && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
            onClick={closeModal}
          >
            <div
              className="surface-card w-full max-w-md overflow-hidden bg-card/95"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="bounty-action-title"
              aria-describedby="bounty-action-description"
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      confirm === 'reject' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {confirm === 'reject' ? (
                      <XCircle className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                    ) : (
                      <PauseCircle className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={loading}
                    aria-label="Close dialog"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-red-200 hover:text-red-600 disabled:opacity-50"
                  >
                    <X className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                  </button>
                </div>

                <p
                  className={`mt-5 text-xs font-semibold uppercase tracking-[0.16em] ${
                    confirm === 'reject' ? 'text-red-500' : 'text-amber-500'
                  }`}
                >
                  {confirm === 'reject' ? 'Reject bounty' : 'Hold bounty'}
                </p>
                <h3
                  id="bounty-action-title"
                  className="font-display mt-1 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl"
                >
                  {confirm === 'reject' ? 'Reject this bounty?' : 'Place this bounty on hold?'}
                </h3>
                <p
                  id="bounty-action-description"
                  className="mt-3 text-sm leading-6 text-muted-foreground"
                >
                  {confirm === 'reject'
                    ? 'The milestone will be marked rejected and its amount will return to the repository escrow pool.'
                    : 'This will dispute the on-chain milestone without cancelling the bounty.'}
                </p>

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="ghost" onClick={closeModal} disabled={loading}>
                    Cancel
                  </Button>
                  <Button
                    variant={confirm === 'reject' ? 'danger' : 'warning'}
                    onClick={() =>
                      void runAction(confirm, confirm === 'reject' ? 'Reject' : 'Hold')
                    }
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <LoadingLogo size="tiny" variant="circle" />
                        Working
                      </>
                    ) : confirm === 'reject' ? (
                      'Reject bounty'
                    ) : (
                      'Place on hold'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
