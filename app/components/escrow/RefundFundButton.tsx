'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDownToLine, Check, X, Wallet } from 'lucide-react';
import { handleError, notifySuccess } from '@/lib/notifications';
import LoadingLogo from '@/app/components/layout/LoadingLogo';
import Button from '@/app/components/ui/Button';
import { authHeaders, backendUrl } from '@/lib/backend';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';

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

function isValidStellarAddress(address: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(address.trim());
}

function extractBackendMessage(raw: string): string {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (json) {
    try {
      const parsed = JSON.parse(json) as { message?: unknown; error?: unknown };
      const inner = parsed.message ?? parsed.error;
      if (typeof inner === 'string' && inner.trim()) return inner;
    } catch {
      // fall through to raw
    }
  }
  return raw;
}

export default function RefundFundButton({
  repoId,
  token,
  currentBalance,
}: {
  repoId: string;
  token: string;
  currentBalance: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wallet, setWallet] = useState('');
  const [profileWallet, setProfileWallet] = useState('');

  useEffect(() => {
    async function loadProfileWallet() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.user_metadata?.stellar_address) {
          setProfileWallet(user.user_metadata.stellar_address);
        }
      } catch {
        // Fail silently
      }
    }
    loadProfileWallet();
  }, []);

  const available = Math.max(0, currentBalance);
  const activeWallet = wallet;
  const isWalletValid = isValidStellarAddress(activeWallet);
  const canSubmit = isWalletValid;

  function openDialog() {
    setOpen(true);
    setError('');
    setWallet(profileWallet || '');
  }

  function closeDialog(nextOpen: boolean) {
    if (loading) return;
    setOpen(nextOpen);
    if (!nextOpen) {
      setError('');
    }
  }

  async function handleRefund() {
    setError('');

    if (!isWalletValid) {
      setError('Enter a valid Stellar wallet address or use your profile wallet.');
      return;
    }

    setLoading(true);

    try {
      const body = {
        repoId,
        maintainerWallet: activeWallet,
      };

      const res = await fetch(backendUrl('/api/v1/escrow/refund'), {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const raw =
          (typeof errData.error === 'string' && errData.error) ||
          (typeof errData.message === 'string' && errData.message) ||
          `HTTP ${res.status}: Withdraw failed`;
        throw new Error(extractBackendMessage(raw));
      }

      const data = (await res.json()) as {
        refundedAmount?: number | string;
        cancelledIssues?: number;
      };
      const refunded = Number(data.refundedAmount ?? 0);
      const cancelled = Number(data.cancelledIssues ?? 0);

      notifySuccess(
        'Withdraw complete',
        `${formatUsdc(refunded)} USDC refunded. ${cancelled} bounties cancelled.`
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
                Full Withdraw
              </DialogTitle>
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

        <div className="space-y-6 px-5 py-6 sm:px-6">
          {/* ── AMOUNT DISPLAY ── */}
          <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-gradient-to-br from-muted/50 to-background p-6">
            <div className="flex items-center justify-between">
              <span className="text-[0.6rem] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
                Total refund
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[0.6rem] font-semibold tracking-wider text-muted-foreground uppercase">
                <Image
                  src="/usd-coin-usdc-logo.svg"
                  alt=""
                  width={12}
                  height={12}
                  className="size-3"
                />
                USDC
              </span>
            </div>

            {/* Amount display */}
            <div className="relative mt-4 flex items-end gap-2">
              <span className="block w-full font-mono text-5xl font-bold tracking-tighter text-foreground tabular-nums">
                {formatUsdc(available)}
              </span>
            </div>
          </div>

          {/* Full refund warning */}
          <Alert
            variant="destructive"
            className="rounded-2xl border-red-200 bg-red-50 text-red-900"
          >
            <AlertTriangle className="size-4 text-red-600" />
            <AlertDescription className="text-xs font-bold text-red-900">
              This cancels every active bounty and cannot be undone.
            </AlertDescription>
          </Alert>

          {/* ── DESTINATION WALLET ── */}
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Destination wallet
            </Label>

            {/* Use profile wallet chip - toggle to select/deselect */}
            {profileWallet && (
              <button
                type="button"
                onClick={() => {
                  // Toggle: if already selected, deselect; otherwise select
                  setWallet(wallet === profileWallet ? '' : profileWallet);
                  setError('');
                }}
                disabled={loading}
                className={`group flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 ${
                  wallet === profileWallet
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                    : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
                }`}
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl transition ${
                    wallet === profileWallet
                      ? 'bg-primary text-white'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                  }`}
                >
                  <Wallet className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
                    Profile wallet
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wide text-emerald-700 uppercase dark:bg-emerald-500/15 dark:text-emerald-300">
                      Linked
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-xs text-muted-foreground">
                    {shortenAddress(profileWallet)}
                  </span>
                </span>
                {wallet === profileWallet && (
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Check className="size-3 text-white" strokeWidth={3.5} aria-hidden="true" />
                  </span>
                )}
              </button>
            )}

            {/* Wallet address input */}
            <div
              className={`flex items-center gap-2 rounded-2xl border bg-card px-3.5 py-2.5 transition-colors ${
                wallet && !isValidStellarAddress(wallet)
                  ? 'border-destructive ring-3 ring-destructive/20'
                  : 'border-input focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20'
              }`}
            >
              <Input
                type="text"
                value={wallet}
                disabled={loading}
                placeholder="Paste Stellar address (G…)"
                className="h-9 flex-1 border-0 bg-transparent px-0 font-mono text-sm shadow-none focus-visible:border-0 focus-visible:ring-0"
                onChange={(event) => {
                  setWallet(event.target.value.trim());
                  setError('');
                }}
              />
              {wallet && isValidStellarAddress(wallet) && (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
                </span>
              )}
            </div>

            {wallet && !isValidStellarAddress(wallet) && (
              <p className="text-xs font-medium text-destructive">
                Invalid address. Must start with G and be 56 characters.
              </p>
            )}
          </div>

          {error ? (
            <Alert variant="destructive" className="rounded-2xl">
              <AlertTriangle className="size-4" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="ghost" onClick={() => closeDialog(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleRefund}
            disabled={loading || !canSubmit}
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
                Full Withdraw
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
