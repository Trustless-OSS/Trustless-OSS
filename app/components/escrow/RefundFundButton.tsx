'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDownToLine, Check, PenLine, X, Wallet } from 'lucide-react';
import { handleError, notifySuccess } from '@/lib/notifications';
import { getWalletKit } from '@/lib/wallet-kit';
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

type WalletSource = 'profile' | 'other';

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
  const [walletSource, setWalletSource] = useState<WalletSource>('other');
  const [profileWallet, setProfileWallet] = useState('');
  const [otherWallet, setOtherWallet] = useState('');

  useEffect(() => {
    let active = true;
    async function loadProfileWallet() {
      try {
        const res = await fetch(backendUrl('/contributor/me'), {
          headers: authHeaders(token, false),
          cache: 'no-store',
        });
        if (res.ok) {
          const json = await res.json();
          const contributor = json?.contributor ?? json?.data?.contributor;
          const address = contributor?.stellar_wallet;
          if (active && typeof address === 'string' && isValidStellarAddress(address)) {
            setProfileWallet(address);
            return;
          }
        }
      } catch {
        // A browser wallet may still be connected if the profile request fails.
      }
      try {
        const kit = await getWalletKit();
        const { address } = await kit.getAddress();
        if (active && isValidStellarAddress(address)) setProfileWallet(address);
      } catch {
        // The manual destination remains available if no wallet is selected.
      }
    }
    void loadProfileWallet();
    return () => {
      active = false;
    };
  }, [token]);

  const available = Math.max(0, currentBalance);
  const activeWallet = walletSource === 'profile' ? profileWallet.trim() : otherWallet.trim();
  const isWalletValid = isValidStellarAddress(activeWallet);
  const canSubmit = isWalletValid;

  function openDialog() {
    setOpen(true);
    setError('');
    setOtherWallet('');
    setWalletSource(isValidStellarAddress(profileWallet) ? 'profile' : 'other');
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
      setError('Choose a valid Stellar destination address.');
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
        className="max-h-[calc(100dvh-1.5rem)] gap-0 overflow-y-auto rounded-xl p-0 sm:max-w-md"
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
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive ring-1 ring-destructive/15">
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
          <div className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-muted/50 to-background p-6">
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
          <Alert variant="destructive" className="rounded-lg border-red-200 bg-red-50 text-red-900">
            <AlertTriangle className="size-4 text-red-600" />
            <AlertDescription className="text-xs font-bold text-red-900">
              This cancels every active bounty and cannot be undone.
            </AlertDescription>
          </Alert>

          {/* ── DESTINATION WALLET ── */}
          <div className="space-y-3">
            <Label className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              Withdraw to
            </Label>
            <div role="radiogroup" aria-label="Withdrawal destination" className="space-y-2">
              {isValidStellarAddress(profileWallet) && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={walletSource === 'profile'}
                  onClick={() => {
                    setWalletSource('profile');
                    setError('');
                  }}
                  disabled={loading}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
                    walletSource === 'profile'
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <Wallet className="size-5 shrink-0 text-primary" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">Profile wallet</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">
                      {shortenAddress(profileWallet)}
                    </span>
                  </span>
                  {walletSource === 'profile' && (
                    <Check className="size-4 text-primary" aria-hidden="true" />
                  )}
                </button>
              )}
              <button
                type="button"
                role="radio"
                aria-checked={walletSource === 'other'}
                onClick={() => {
                  setWalletSource('other');
                  setError('');
                }}
                disabled={loading}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors disabled:opacity-50 ${
                  walletSource === 'other'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/15'
                    : 'border-border bg-card hover:border-primary/40'
                }`}
              >
                <PenLine className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="flex-1 text-sm font-semibold">Other Stellar address</span>
                {walletSource === 'other' && (
                  <Check className="size-4 text-primary" aria-hidden="true" />
                )}
              </button>
            </div>

            {walletSource === 'other' ? (
              <div className="space-y-1.5">
                <Label htmlFor="withdraw-address" className="text-xs font-semibold">
                  Destination address
                </Label>
                <Input
                  id="withdraw-address"
                  type="text"
                  value={otherWallet}
                  disabled={loading}
                  placeholder="Stellar address (G…)"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono text-sm"
                  aria-invalid={Boolean(otherWallet) && !isValidStellarAddress(otherWallet)}
                  onChange={(event) => {
                    setOtherWallet(event.target.value.trim());
                    setError('');
                  }}
                />
                {otherWallet && !isValidStellarAddress(otherWallet) && (
                  <p className="text-xs font-medium text-destructive">
                    Enter a valid 56-character Stellar address starting with G.
                  </p>
                )}
              </div>
            ) : null}

            {isWalletValid && (
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs font-semibold text-muted-foreground">
                  Destination to confirm
                </p>
                <p className="mt-1 break-all font-mono text-xs text-foreground">{activeWallet}</p>
              </div>
            )}
            <p className="text-xs leading-5 text-muted-foreground">
              The escrow verifies the recorded funder before sending a refund. Other addresses may
              be rejected.
            </p>
          </div>
          {error ? (
            <Alert variant="destructive" className="rounded-lg">
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
