'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Pencil } from 'lucide-react';
import { notifySuccess, handleError } from '@/lib/notifications';
import AppButton from '@/app/components/ui/Button';
import LoadingLogo from '@/app/components/layout/LoadingLogo';
import { backendUrl } from '@/lib/backend';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface RewardLevel {
  label: string;
  amount: number;
}

interface RewardSettingsFormProps {
  repoId: string;
  token: string;
  initialLevels: RewardLevel[];
}

// Colour palette cycles for any number of tiers coming from the backend
const ACCENT_PALETTE = [
  {
    accent: 'border-l-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/12',
    media: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  },
  {
    accent: 'border-l-amber-400 bg-amber-50/80 dark:bg-amber-500/12',
    media: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  },
  {
    accent: 'border-l-rose-400 bg-rose-50/80 dark:bg-rose-500/12',
    media: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
  },
  {
    accent: 'border-l-violet-400 bg-violet-50/80 dark:bg-violet-500/12',
    media: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
  },
  {
    accent: 'border-l-cyan-400 bg-cyan-50/80 dark:bg-cyan-500/12',
    media: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
  },
];

function paletteFor(index: number) {
  return ACCENT_PALETTE[index % ACCENT_PALETTE.length];
}

function formatUsdc(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return value;
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export default function RewardSettingsForm({
  repoId,
  token,
  initialLevels,
}: RewardSettingsFormProps) {
  // saved is a map of label → amount string, keyed by the backend label
  const [saved, setSaved] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialLevels.map((r) => [r.label, String(r.amount)]))
  );
  // labels order preserved from backend
  const [labels] = useState<string[]>(() => initialLevels.map((r) => r.label));

  const [draft, setDraft] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingKey) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingKey]);

  function displayValue(key: string) {
    return editingKey === key ? draft : (saved[key] ?? '0');
  }

  function startEditing(key: string) {
    if (saving || confirmOpen) return;
    setEditingKey(key);
    setDraft(saved[key] ?? '0');
  }

  function cancelPending() {
    setConfirmOpen(false);
    setPendingKey(null);
    setDraft('');
    setEditingKey(null);
  }

  function requestConfirm(key: string, nextValue: string) {
    const normalized = nextValue.trim() === '' ? '0' : nextValue;
    if (normalized === (saved[key] ?? '0')) {
      setEditingKey(null);
      setDraft('');
      return;
    }
    setDraft(normalized);
    setPendingKey(key);
    setEditingKey(null);
    setConfirmOpen(true);
  }

  function handleBlur(key: string) {
    if (editingKey !== key || confirmOpen) return;
    requestConfirm(key, draft);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setEditingKey(null);
      setDraft('');
    }
  }

  async function confirmSave() {
    if (!pendingKey) return;

    const nextSaved = {
      ...saved,
      [pendingKey]: draft.trim() === '' ? '0' : draft,
    };

    setSaving(true);
    try {
      // Build the payload from all current labels so the backend stays in sync
      const rewardsPayload = Object.fromEntries(
        labels.map((lbl) => [`reward_${lbl.toLowerCase()}`, parseFloat(nextSaved[lbl] ?? '0') || 0])
      );

      const res = await fetch(backendUrl(`/api/v1/repos/${repoId}/rewards`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(rewardsPayload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || 'Failed to update rewards');
      }

      setSaved(nextSaved);
      setConfirmOpen(false);
      setPendingKey(null);
      setDraft('');
      notifySuccess(
        'Reward updated',
        `${pendingKey.charAt(0).toUpperCase() + pendingKey.slice(1)} is now ${formatUsdc(nextSaved[pendingKey])} USDC.`
      );
    } catch (e) {
      handleError(e, 'Update Rewards');
    } finally {
      setSaving(false);
    }
  }

  const pendingPalette = pendingKey
    ? paletteFor(labels.indexOf(pendingKey))
    : ACCENT_PALETTE[0];
  const fromAmount = pendingKey ? formatUsdc(saved[pendingKey] ?? '0') : '—';
  const toAmount = formatUsdc(draft);

  return (
    <section aria-labelledby="reward-parameters-heading">
      <div className="mb-3">
        <h2
          id="reward-parameters-heading"
          className="text-xl font-black tracking-tight text-foreground"
        >
          Reward parameters
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {labels.map((key, index) => {
          const palette = paletteFor(index);
          const isEditing = editingKey === key;
          const value = displayValue(key);
          const displayLabel = key.charAt(0).toUpperCase() + key.slice(1);

          return (
            <div
              key={key}
              className={cn(
                'flex min-h-[4.75rem] flex-col justify-between rounded-2xl border-l-4 px-4 py-3 ring-1 ring-border/50',
                palette.accent
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <Label
                  htmlFor={isEditing ? `reward-${key}` : undefined}
                  className="text-sm font-semibold tracking-[0.12em] text-muted-foreground uppercase"
                >
                  {displayLabel}
                </Label>
                {!isEditing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => startEditing(key)}
                    disabled={saving || confirmOpen || editingKey !== null}
                    aria-label={`Edit ${displayLabel} reward`}
                    title={`Edit ${displayLabel}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Pencil strokeWidth={2.25} aria-hidden="true" />
                  </Button>
                ) : null}
              </div>

              <div className="mt-1.5 flex h-8 items-center gap-2">
                {isEditing ? (
                  <Input
                    ref={inputRef}
                    id={`reward-${key}`}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={draft}
                    disabled={saving}
                    aria-label={`${displayLabel} reward in USDC`}
                    className="h-8 border-0 bg-transparent px-0 font-mono text-xl font-black shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-xl"
                    onChange={(event) => setDraft(event.target.value)}
                    onBlur={() => handleBlur(key)}
                    onKeyDown={handleKeyDown}
                  />
                ) : (
                  <span className="font-mono text-xl font-black tracking-tight text-foreground tabular-nums">
                    {value}
                  </span>
                )}
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">USDC</span>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !saving) cancelPending();
        }}
      >
        <AlertDialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
          <AlertDialogHeader className="gap-3 p-5 sm:p-6">
            <AlertDialogMedia
              className={cn('mb-0 size-12 rounded-2xl', pendingPalette.media)}
            >
              <Pencil className="size-5" strokeWidth={2.25} aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-display text-xl font-extrabold tracking-tight">
              Update {pendingKey?.toLowerCase()} reward?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-6">
              This changes the {pendingKey?.toLowerCase()} bounty amount for newly discovered
              issues. Existing bounties keep their original reward.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="px-5 pb-5 sm:px-6">
            <div className="flex items-center gap-3 rounded-2xl bg-muted/70 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Current
                </p>
                <p className="mt-1 font-mono text-lg font-black tracking-tight tabular-nums">
                  {fromAmount}{' '}
                  <span className="text-xs font-semibold text-muted-foreground">USDC</span>
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" />
              <div className="min-w-0 flex-1 text-right">
                <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  New
                </p>
                <p className="mt-1 font-mono text-lg font-black tracking-tight text-primary tabular-nums">
                  {toAmount}{' '}
                  <span className="text-xs font-semibold text-muted-foreground">USDC</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <AppButton
              variant="outline"
              size="sm"
              onClick={cancelPending}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              Cancel
            </AppButton>
            <AppButton
              variant="solid"
              size="sm"
              onClick={confirmSave}
              disabled={saving}
              className="w-full sm:min-w-28 sm:w-auto"
            >
              {saving ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  Saving
                </>
              ) : (
                'Confirm'
              )}
            </AppButton>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
