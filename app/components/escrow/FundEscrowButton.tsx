'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, ArrowRight, Check, ExternalLink, Plus, X } from 'lucide-react';
import { getWalletKit, withTimeout, WALLET_OPERATION_TIMEOUT_MS } from '@/lib/wallet-kit';
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
import { Progress } from '@/components/ui/progress';

type ModalPhase = 'amount' | 'wallet' | 'sign' | 'processing' | 'success' | 'error';

function formatUsdc(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const QUICK_AMOUNTS = [25, 50, 100] as const;

export default function FundEscrowButton({
  repoId,
  token,
  repoName,
  currentBalance,
}: {
  repoId: string;
  token: string;
  repoName?: string;
  currentBalance?: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [phase, setPhase] = useState<ModalPhase>('amount');
  const [transactionHash, setTransactionHash] = useState('');
  const [confirmedBalance, setConfirmedBalance] = useState<number | null>(null);

  const parsedAmount = Number(amount);
  const isAmountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const showAmountError = submitAttempted && !isAmountValid;
  const currentBalanceValue = currentBalance ?? 0;
  const nextBalance = confirmedBalance ?? currentBalanceValue + (isAmountValid ? parsedAmount : 0);
  const amountLocked = loading || phase === 'success' || phase === 'error';

  const progressValue =
    phase === 'amount'
      ? 0
      : phase === 'wallet'
        ? 35
        : phase === 'sign'
          ? 65
          : phase === 'processing'
            ? 85
            : phase === 'success'
              ? 100
              : 20;

  const statusLabel =
    phase === 'wallet'
      ? 'Connecting wallet…'
      : phase === 'sign'
        ? 'Sign the transaction in your wallet'
        : phase === 'processing'
          ? 'Confirming deposit and syncing balance…'
          : phase === 'success'
            ? 'Deposit confirmed'
            : phase === 'error'
              ? 'Deposit failed'
              : null;

  function resetState() {
    setAmount('');
    setSubmitAttempted(false);
    setPhase('amount');
    setTransactionHash('');
    setConfirmedBalance(null);
    setError('');
    setLoading(false);
  }

  function openDialog() {
    resetState();
    setOpen(true);
  }

  function closeDialog(nextOpen: boolean) {
    if (loading) return;
    setOpen(nextOpen);
    if (!nextOpen) resetState();
  }

  function handleCloseAndRefresh() {
    setOpen(false);
    router.refresh();
  }

  async function handleFund() {
    setSubmitAttempted(true);
    setError('');

    if (!isAmountValid) {
      setPhase('amount');
      return;
    }

    setLoading(true);
    setPhase('wallet');

    try {
      const kit = await getWalletKit();

      // Radix dialog overlay (z-50) sits above Stellar Wallets Kit and blocks wallet UI clicks.
      setOpen(false);

      const { address } = await withTimeout(
        kit.authModal(),
        WALLET_OPERATION_TIMEOUT_MS,
        'Wallet authorization timed out. Please close the wallet modal and try again.'
      );
      if (!address) throw new Error('No public key returned');

      setOpen(true);
      setPhase('sign');

      const res1 = await fetch(backendUrl('/api/escrow/fund-unsigned'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repoId,
          amount: parsedAmount,
          funderWallet: address,
        }),
      });

      if (!res1.ok) {
        const errData = await res1.json();
        const errorMessage = errData.error || errData.message || '';
        if (errorMessage.toLowerCase().includes('insufficient funds')) {
          throw new Error('Insufficient funds in your wallet to cover the escrow + gas.');
        }
        throw new Error(errorMessage || 'Failed to generate funding transaction');
      }

      const { unsignedTransaction } = await res1.json();

      setOpen(false);
      setPhase('sign');
      const { signedTxXdr } = await withTimeout(
        kit.signTransaction(unsignedTransaction),
        WALLET_OPERATION_TIMEOUT_MS,
        'Transaction signing timed out. Please close the wallet modal and try again.'
      );
      setOpen(true);
      setPhase('processing');

      const res2 = await fetch(backendUrl('/api/escrow/submit-fund'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          repoId,
          amount: parsedAmount,
          funderWallet: address,
          signedXdr: signedTxXdr,
        }),
      });

      if (!res2.ok) {
        const errData = await res2.json();
        throw new Error(errData.error || errData.message || 'Failed to submit funding transaction');
      }

      const result = await res2.json();
      const nextHash =
        result?.transactionHash || result?.hash || result?.txHash || result?.txid || '';
      const reportedBalance = Number(result?.newBalance ?? result?.new_balance);
      if (Number.isFinite(reportedBalance)) {
        setConfirmedBalance(reportedBalance);
      }
      setTransactionHash(nextHash);
      setPhase('success');
      router.refresh();
    } catch (err: unknown) {
      setOpen(true);
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Failed to fund');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={closeDialog}>
      <Button
        variant="solid"
        onClick={openDialog}
        disabled={loading}
        className="w-full gap-1.5 sm:w-auto"
      >
        {loading ? (
          <>
            <LoadingLogo size="tiny" variant="circle" />
            Processing
          </>
        ) : (
          <>
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            Fund
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
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <Plus className="size-5" strokeWidth={2.5} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="font-display text-2xl font-extrabold tracking-tight">
                  Fund
                </DialogTitle>
                <DialogDescription className="mt-0.5 truncate text-sm text-muted-foreground">
                  {repoName || 'Repository escrow'}
                </DialogDescription>
              </div>
            </div>
            <DialogClose asChild>
              <button
                type="button"
                disabled={loading}
                aria-label="Close fund dialog"
                className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
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
                Current balance
              </p>
              <p className="mt-1 text-2xl font-black tracking-tight tabular-nums">
                {formatUsdc(currentBalanceValue)}{' '}
                <span className="text-sm font-semibold text-muted-foreground">USDC</span>
              </p>
            </div>
            <Image src="/usd-coin-usdc-logo.svg" alt="" width={36} height={36} className="size-9" />
          </div>

          <div className="space-y-3">
            <Label htmlFor="fund-amount" className="text-sm font-semibold">
              Amount
            </Label>

            <div
              className={`flex items-center gap-2 rounded-2xl border bg-background px-3 py-2 transition-colors ${
                showAmountError
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
                id="fund-amount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={amount}
                disabled={amountLocked}
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

            <div className="flex flex-wrap gap-2">
              {QUICK_AMOUNTS.map((value) => (
                <button
                  key={value}
                  type="button"
                  disabled={amountLocked}
                  onClick={() => {
                    setAmount(String(value));
                    setError('');
                  }}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
                >
                  +{value}
                </button>
              ))}
            </div>

            {showAmountError ? (
              <p className="text-xs font-medium text-destructive">
                Enter an amount greater than 0.
              </p>
            ) : (
              <p
                aria-label={`Balance changes from ${formatUsdc(currentBalanceValue)} to ${formatUsdc(nextBalance)} USDC`}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span>New balance</span>
                <ArrowRight className="size-3.5 text-primary" aria-hidden="true" />
                <span className="font-semibold tabular-nums text-foreground">
                  {formatUsdc(nextBalance)} USDC
                </span>
              </p>
            )}
          </div>

          {statusLabel ? (
            <div className="space-y-2">
              {phase !== 'error' && phase !== 'success' ? (
                <Progress value={progressValue} aria-label="Funding progress" />
              ) : null}
              <Alert
                variant={phase === 'error' ? 'destructive' : 'default'}
                className={`rounded-2xl ${
                  phase === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/5'
                    : phase === 'error'
                      ? 'border-destructive/20 bg-destructive/5'
                      : 'bg-muted/50'
                }`}
              >
                {loading ? (
                  <LoadingLogo size="tiny" variant="circle" />
                ) : phase === 'success' ? (
                  <Check className="size-4 text-emerald-600" aria-hidden="true" />
                ) : phase === 'error' ? (
                  <AlertTriangle aria-hidden="true" />
                ) : null}
                <AlertDescription
                  className={
                    phase === 'success' ? 'text-emerald-800 dark:text-emerald-200' : undefined
                  }
                >
                  {statusLabel}
                  {error ? <span className="mt-1 block">{error}</span> : null}
                  {phase === 'success' && transactionHash ? (
                    <a
                      href={`https://stellar.expert/explorer/public/tx/${transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 font-medium text-primary"
                    >
                      View transaction
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </AlertDescription>
              </Alert>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <Button variant="ghost" onClick={() => closeDialog(false)} disabled={loading}>
            {phase === 'success' || phase === 'error' ? 'Close' : 'Cancel'}
          </Button>
          {phase === 'error' ? null : (
            <Button
              variant="solid"
              onClick={phase === 'success' ? handleCloseAndRefresh : handleFund}
              disabled={loading}
              className="min-w-28 gap-1.5"
            >
              {loading ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  Waiting…
                </>
              ) : phase === 'success' ? (
                'Done'
              ) : (
                <>
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
