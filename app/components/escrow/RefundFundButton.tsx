'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDownToLine, Copy, Check, ExternalLink, X } from 'lucide-react';
import { handleError, notifySuccess } from '@/lib/notifications';
import LoadingLogo from '@/app/components/layout/LoadingLogo';
import Button from '@/app/components/ui/Button';
import { backendUrl } from '@/lib/backend';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

function roundUsdc(value: number) {
  return Math.round(value * 100) / 100;
}

function formatUsdc(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function shortenAddress(address: string) {
  if (address.length < 16) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function stellarAccountUrl(address: string) {
  return `https://stellar.expert/explorer/public/account/${address}`;
}

export default function RefundFundButton({
  repoId,
  token,
  currentBalance,
  destinationAddress,
}: {
  repoId: string;
  token: string;
  currentBalance: number;
  destinationAddress?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [copied, setCopied] = useState(false);

  const available = Math.max(0, currentBalance);
  const parsedAmount = Number(amount);
  const isAmountValid =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= available + 1e-9;
  const isFullWithdraw = isAmountValid && parsedAmount >= available - 1e-9;
  const showAmountError = submitAttempted && !isAmountValid;
  const sliderValue = Math.min(
    available,
    Math.max(0, Number.isFinite(parsedAmount) ? roundUsdc(parsedAmount) : 0)
  );
  const destination = destinationAddress?.trim() || '';

  function openDialog() {
    setOpen(true);
    setError('');
    setSubmitAttempted(false);
    setCopied(false);
    setAmount(available > 0 ? available.toFixed(2) : '');
  }

  function closeDialog(nextOpen: boolean) {
    if (loading) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setError('');
      setSubmitAttempted(false);
      setCopied(false);
    }
  }

  function setMax() {
    setAmount(available.toFixed(2));
    setError('');
  }

  function updateAmount(next: number) {
    setError('');
    setAmount(roundUsdc(Math.min(available, Math.max(0, next))).toFixed(2));
  }

  async function copyDestination() {
    if (!destination) return;
    try {
      await navigator.clipboard.writeText(destination);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      handleError(err, 'Copy address');
    }
  }

  async function handleWithdraw() {
    setSubmitAttempted(true);
    setError('');

    if (available <= 0) {
      setError('No funds available to withdraw.');
      return;
    }

    if (!isAmountValid) {
      setError(
        parsedAmount > available
          ? `Amount exceeds available balance (${formatUsdc(available)} USDC).`
          : 'Enter an amount greater than 0.'
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(backendUrl('/api/v1/escrow/refund'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repoId,
          amount: parsedAmount,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          typeof errData.error === 'string' ? errData.error : 'Withdraw failed. Try again.'
        );
      }

      const data = (await res.json()) as {
        refundedAmount?: number | string;
        cancelledIssues?: number;
      };
      const refunded = Number(data.refundedAmount ?? parsedAmount);
      const cancelled = Number(data.cancelledIssues ?? 0);

      notifySuccess(
        'Withdraw complete',
        `${formatUsdc(refunded)} USDC returned to your wallet${cancelled > 0
          ? `. ${cancelled} active issue${cancelled === 1 ? '' : 's'} cancelled.`
          : '.'
        }`
      );
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      handleError(err, 'Withdraw');
      const message = err instanceof Error ? err.message : 'Withdraw failed';
      setError(
        message.includes('Failed to fetch') ? 'Network error: cannot reach the server.' : message
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <Button
        variant="warning"
        onClick={openDialog}
        disabled={loading || available <= 0}
        className="w-full gap-1.5 sm:w-auto"
      >
        {loading ? (
          <>
            <LoadingLogo size="tiny" variant="circle" />
            Processing
          </>
        ) : (
          <>
            <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            Withdraw
          </>
        )}
      </Button>

      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md"
        onPointerDownOutside={(event) => {
          if (loading) event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (loading) event.preventDefault();
        }}
      >
        <DialogHeader className="border-b border-border/70 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive ring-1 ring-destructive/15">
                <ArrowDownToLine className="size-5" aria-hidden="true" />
              </span>
              <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">
                Withdraw
              </DialogTitle>
              <DialogDescription className="sr-only">
                Enter how much USDC to withdraw from escrow.
              </DialogDescription>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                disabled={loading}
                aria-label="Close withdraw dialog"
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-destructive/30 hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
              >
                <X className="size-4" strokeWidth={2.5} aria-hidden="true" />
              </button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-muted/70 px-4 py-3">
            <div>
              <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Available
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight tabular-nums">
                {formatUsdc(available)}{' '}
                <span className="text-sm font-semibold text-muted-foreground">USDC</span>
              </p>
            </div>
            <Image src="/usd-coin-usdc-logo.svg" alt="" width={36} height={36} className="size-9" />
          </div>

          <div className="space-y-2 rounded-2xl bg-muted/50 px-4 py-3">
            <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Destination
            </p>
            {destination ? (
              <div className="flex items-center justify-between gap-2">
                <a
                  href={stellarAccountUrl(destination)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 font-mono text-sm font-semibold text-foreground hover:text-primary"
                  title={destination}
                >
                  <span className="truncate">{shortenAddress(destination)}</span>
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="sr-only">View on StellarExpert</span>
                </a>
                <button
                  type="button"
                  onClick={copyDestination}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                  aria-label="Copy destination address"
                >
                  {copied ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <Copy className="size-3.5" aria-hidden="true" />
                  )}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Funds return to the wallet that funded this escrow.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="withdraw-amount" className="text-sm font-semibold">
                Amount
              </Label>
              <button
                type="button"
                onClick={setMax}
                disabled={loading || available <= 0}
                className="text-xs font-semibold text-primary hover:underline disabled:pointer-events-none disabled:opacity-50"
              >
                Max
              </button>
            </div>

            <div
              className={`flex items-center gap-2 rounded-2xl border bg-background px-3 py-2 transition-colors ${showAmountError
                  ? 'border-destructive ring-3 ring-destructive/20'
                  : 'border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50'
                }`}
            >
              <Image
                src="/usd-coin-usdc-logo.svg"
                alt=""
                width={22}
                height={22}
                className="size-5"
              />
              <Input
                id="withdraw-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                max={available}
                value={amount}
                disabled={loading}
                aria-invalid={showAmountError || undefined}
                placeholder="0.00"
                className="h-11 border-0 bg-transparent px-0 text-2xl font-black tracking-tight shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-2xl"
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError('');
                }}
              />
              <span className="shrink-0 text-sm font-semibold text-muted-foreground">USDC</span>
            </div>

            <div className="space-y-2 px-0.5 pt-1">
              <Slider
                min={0}
                max={available || 1}
                step={0.01}
                value={[sliderValue]}
                disabled={loading || available <= 0}
                aria-label="Withdraw amount"
                onValueChange={(value) => updateAmount(value[0] ?? 0)}
              />
              <div className="flex items-center justify-end text-xs text-muted-foreground">
                <span>{formatUsdc(available)}</span>
              </div>
            </div>

            {showAmountError ? (
              <p className="text-xs font-medium text-destructive">
                {parsedAmount > available
                  ? `Max available is ${formatUsdc(available)} USDC.`
                  : 'Enter an amount greater than 0.'}
              </p>
            ) : null}
          </div>

          {isFullWithdraw ? (
            <Alert
              variant="destructive"
              className="rounded-2xl border-destructive/20 bg-destructive/5"
            >
              <AlertTriangle />
              <AlertDescription>
                Full withdraw cancels every active bounty. This cannot be undone.
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertTriangle />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="ghost" onClick={() => closeDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleWithdraw}
            disabled={loading || !isAmountValid}
            className="min-w-28"
          >
            {loading ? (
              <>
                <LoadingLogo size="tiny" variant="circle" />
                Withdrawing
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
                Withdraw
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
