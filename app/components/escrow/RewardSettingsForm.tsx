'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { notifySuccess, handleError } from '@/lib/notifications';
import AppButton from '@/app/components/ui/Button';
import LoadingLogo from '@/app/components/layout/LoadingLogo';
import { authHeaders, backendUrl } from '@/lib/backend';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewardLevel {
  label: string;
  amount: number;
}
interface GitHubLabel {
  name: string;
  color: string;
  description?: string | null;
}
interface RewardSettingsFormProps {
  repoId: string;
  token: string;
  initialLevels: RewardLevel[];
}

// ─── Palette ─────────────────────────────────────────────────────────────────

const PALETTE = [
  { accent: 'border-l-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/12' },
  { accent: 'border-l-amber-400 bg-amber-50/80 dark:bg-amber-500/12' },
  { accent: 'border-l-rose-400 bg-rose-50/80 dark:bg-rose-500/12' },
  { accent: 'border-l-violet-400 bg-violet-50/80 dark:bg-violet-500/12' },
  { accent: 'border-l-cyan-400 bg-cyan-50/80 dark:bg-cyan-500/12' },
];
const pal = (i: number) => PALETTE[i % PALETTE.length];

// ─── Utils ────────────────────────────────────────────────────────────────────

const fmt = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : v;
};

async function apiUpsert(repoId: string, token: string, label: string, amount: number) {
  const r = await fetch(backendUrl(`/repos/${repoId}/rewards`), {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ label, amount }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    let m = `HTTP ${r.status}`;
    try {
      m = ((JSON.parse(t) as { error?: string }).error ?? t) || m;
    } catch {
      if (t) m = t;
    }
    throw new Error(m);
  }
}

async function apiDelete(repoId: string, token: string, label: string, gh: boolean) {
  const r = await fetch(backendUrl(`/repos/${repoId}/rewards/${encodeURIComponent(label)}`), {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ alsoDeleteGithubLabel: gh }),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    let m = `HTTP ${r.status}`;
    try {
      m = ((JSON.parse(t) as { error?: string }).error ?? t) || m;
    } catch {
      if (t) m = t;
    }
    throw new Error(m);
  }
}

async function apiGhLabels(repoId: string, token: string): Promise<GitHubLabel[]> {
  const r = await fetch(backendUrl(`/repos/${repoId}/github-labels`), {
    headers: authHeaders(token, false),
    cache: 'no-store',
  });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
}

// ─── Component ────────────────────────────────────────────────────────────────

type Mode = 'view' | 'edit' | 'delete';

export default function RewardSettingsForm({
  repoId,
  token,
  initialLevels,
}: RewardSettingsFormProps) {
  const [labels, setLabels] = useState(() => initialLevels.map((r) => r.label));
  const [saved, setSaved] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialLevels.map((r) => [r.label, String(r.amount)]))
  );

  const [mode, setMode] = useState<Mode>('view');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  // ── Edit mode: all cards editable, save only changed ones ─────────────────
  function enterEdit() {
    setDrafts({ ...saved });
    setMode('edit');
  }

  async function saveEdits() {
    const changed = labels.filter((l) => (drafts[l] ?? '') !== (saved[l] ?? ''));
    if (changed.length === 0) {
      setMode('view');
      return;
    }
    setBusy(true);
    try {
      for (const label of changed) {
        await apiUpsert(repoId, token, label, parseFloat(drafts[label]) || 0);
      }
      setSaved((p) => ({ ...p, ...Object.fromEntries(changed.map((l) => [l, drafts[l]])) }));
      setMode('view');
      notifySuccess(
        'Rewards updated',
        `${changed.length} level${changed.length === 1 ? '' : 's'} saved.`
      );
    } catch (e) {
      console.error('[RewardForm] saveEdits:', e);
      handleError(e, 'Update Rewards');
    } finally {
      setBusy(false);
    }
  }

  // ── Delete mode: checkbox per card, confirm removes checked ───────────────
  const [delConfirmOpen, setDelConfirmOpen] = useState(false);
  const [alsoGh, setAlsoGh] = useState(false);
  const checkedLabels = labels.filter((l) => checked[l]);

  function enterDelete() {
    setChecked({});
    setAlsoGh(false);
    setMode('delete');
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      for (const label of checkedLabels) {
        await apiDelete(repoId, token, label, alsoGh);
      }
      setLabels((p) => p.filter((l) => !checked[l]));
      setSaved((p) => {
        const n = { ...p };
        checkedLabels.forEach((l) => delete n[l]);
        return n;
      });
      setDelConfirmOpen(false);
      setMode('view');
      notifySuccess(
        'Levels removed',
        `${checkedLabels.length} removed${alsoGh ? ' from dapp + GitHub' : ''}.`
      );
    } catch (e) {
      console.error('[RewardForm] delete:', e);
      handleError(e, 'Delete Rewards');
    } finally {
      setBusy(false);
    }
  }

  // ── Add tier dialog ─────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'github' | 'custom'>('github');
  const [ghLabels, setGhLabels] = useState<GitHubLabel[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [ghLabel, setGhLabel] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const customRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && tab === 'custom') setTimeout(() => customRef.current?.focus(), 50);
  }, [open, tab]);

  const loadGhLabels = useCallback(async () => {
    setGhLoading(true);
    const list = await apiGhLabels(repoId, token);
    setGhLabels(list.filter((l) => !labels.includes(l.name.toLowerCase())));
    setGhLoading(false);
  }, [repoId, token, labels]);

  useEffect(() => {
    if (open) loadGhLabels();
  }, [open, loadGhLabels]);

  function openDialog() {
    setMode('view');
    setTab('github');
    setGhLabel('');
    setCustomLabel('');
    setAmount('');
    setError('');
    setOpen(true);
  }

  async function submit() {
    const label = (tab === 'github' ? ghLabel : customLabel)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    const value = parseFloat(amount);
    if (!label) {
      setError(tab === 'github' ? 'Select a label to continue.' : 'Enter a label name.');
      return;
    }
    if (labels.includes(label)) {
      setError(`“${label}” is already configured.`);
      return;
    }
    if (!Number.isFinite(value) || value < 0) {
      setError('Enter a valid amount of 0 or more.');
      return;
    }
    setSaving(true);
    try {
      await apiUpsert(repoId, token, label, value);
      setSaved((p) => ({ ...p, [label]: String(value) }));
      setLabels((p) => [...p, label]);
      setOpen(false);
      notifySuccess('Tier added', `“${label}” now pays ${fmt(String(value))} USDC.`);
    } catch (e) {
      console.error('[RewardSettings] submit:', e);
      handleError(e, 'Add tier');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="reward-params-heading">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="reward-params-heading"
          className="text-xl font-black tracking-tight text-foreground"
        >
          Reward parameters
        </h2>

        <div className="flex items-center gap-2">
          {mode === 'view' && (
            <>
              {labels.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={enterEdit}
                    className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold"
                  >
                    <Pencil className="size-3.5" strokeWidth={2.5} />
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={enterDelete}
                    className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold text-destructive hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" strokeWidth={2.5} />
                    Delete
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openDialog}
                className="h-8 gap-1.5 rounded-lg border-dashed px-3 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
              >
                <Plus className="size-3.5" strokeWidth={2.5} />
                Label
              </Button>
            </>
          )}

          {mode === 'edit' && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode('view')}
                disabled={busy}
                className="h-8 gap-1.5 px-3 text-xs font-semibold"
              >
                <X className="size-3.5" strokeWidth={2.5} />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={saveEdits}
                disabled={busy}
                className="h-8 gap-1.5 px-3 text-xs font-semibold"
              >
                {busy ? (
                  <LoadingLogo size="tiny" variant="circle" />
                ) : (
                  <Check className="size-3.5" strokeWidth={2.5} />
                )}
                Save
              </Button>
            </>
          )}

          {mode === 'delete' && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMode('view')}
                disabled={busy}
                className="h-8 gap-1.5 px-3 text-xs font-semibold"
              >
                <X className="size-3.5" strokeWidth={2.5} />
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setDelConfirmOpen(true)}
                disabled={busy || checkedLabels.length === 0}
                className="h-8 gap-1.5 px-3 text-xs font-semibold !bg-destructive !text-white hover:!bg-destructive/90 disabled:!bg-muted disabled:!text-muted-foreground"
              >
                <Trash2 className="size-3.5" strokeWidth={2.5} />
                Remove {checkedLabels.length > 0 ? `(${checkedLabels.length})` : ''}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {labels.map((key, i) => {
          const isChecked = Boolean(checked[key]);
          return (
            <Card
              key={key}
              size="sm"
              className={cn(
                'justify-between rounded-2xl border-l-4 transition-all',
                pal(i).accent,
                mode === 'delete' && isChecked ? 'ring-2 ring-destructive/60' : 'ring-border/50',
                mode === 'delete' && 'cursor-pointer'
              )}
              onClick={
                mode === 'delete' ? () => setChecked((c) => ({ ...c, [key]: !c[key] })) : undefined
              }
            >
              <CardHeader>
                <CardTitle className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  {key}
                </CardTitle>
                {mode === 'delete' && (
                  <CardAction>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${key} for removal`}
                      className="h-4 w-4 shrink-0 accent-destructive"
                    />
                  </CardAction>
                )}
              </CardHeader>

              <CardContent className="flex items-center gap-2">
                {mode === 'edit' ? (
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={drafts[key] ?? ''}
                    disabled={busy}
                    aria-label={`${key} reward in USDC`}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    className="h-9 border-0 bg-transparent px-0 font-mono text-2xl font-black shadow-none focus-visible:ring-0"
                  />
                ) : (
                  <p className="font-mono text-2xl font-black tracking-tight text-foreground tabular-nums">
                    {fmt(saved[key] ?? '0')}
                  </p>
                )}
                <span className="shrink-0 text-sm font-semibold text-muted-foreground">USDC</span>
              </CardContent>
            </Card>
          );
        })}

        {labels.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No reward tiers yet. Select <strong className="text-foreground">Add tier</strong> to map
            a label to a payout.
          </p>
        )}
      </div>

      {/* Delete confirm dialog */}
      <Dialog
        open={delConfirmOpen}
        onOpenChange={(o) => {
          if (!busy) setDelConfirmOpen(o);
        }}
      >
        <DialogContent className="overflow-hidden sm:max-w-md">
          <DialogHeader className="flex-row items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <Trash2 className="size-5" strokeWidth={2.25} />
            </span>
            <div className="space-y-1">
              <DialogTitle className="font-display text-lg font-extrabold tracking-tight">
                Remove {checkedLabels.length} tier{checkedLabels.length === 1 ? '' : 's'}?
              </DialogTitle>
              <DialogDescription className="text-sm leading-6">
                {checkedLabels.join(', ')} — issues with{' '}
                {checkedLabels.length === 1 ? 'this label' : 'these labels'} will no longer earn a
                reward.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 hover:bg-muted/60">
              <input
                type="checkbox"
                checked={alsoGh}
                onChange={(e) => setAlsoGh(e.target.checked)}
                disabled={busy}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <div>
                <p className="text-sm font-semibold">Also delete from GitHub</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Permanently removes the matching label{checkedLabels.length === 1 ? '' : 's'} from
                  the repository.
                </p>
              </div>
            </label>
          </div>

          <DialogFooter className="mt-0">
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => setDelConfirmOpen(false)}
              disabled={busy}
              className="w-full sm:w-auto"
            >
              Cancel
            </AppButton>
            <AppButton
              variant="solid"
              size="sm"
              onClick={confirmDelete}
              disabled={busy}
              className="w-full !bg-destructive !text-white hover:!bg-destructive/90 sm:w-auto sm:min-w-28"
            >
              {busy ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  Removing
                </>
              ) : (
                'Remove'
              )}
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add tier dialog */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!saving) setOpen(o);
        }}
      >
        <DialogContent className="overflow-hidden sm:max-w-lg">
          <DialogHeader className="flex-row items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Tag className="size-5" strokeWidth={2.25} />
            </span>
            <div className="space-y-1">
              <DialogTitle className="font-display text-lg font-extrabold tracking-tight">
                New Label Tier
              </DialogTitle>
              <DialogDescription className="text-sm leading-5">
                Map a repository label to a fixed USDC payout.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Source toggle */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
              {(['github', 'custom'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setTab(value);
                    setError('');
                  }}
                  className={cn(
                    'rounded-lg py-1.5 text-sm font-semibold transition-colors',
                    tab === value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {value === 'github' ? 'GitHub label' : 'Custom label'}
                </button>
              ))}
            </div>

            {/* Label selection */}
            {tab === 'github' ? (
              <div className="h-52 overflow-y-auto rounded-xl border border-border bg-muted/30 p-1.5">
                {ghLoading ? (
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                    <LoadingLogo size="tiny" variant="circle" /> Loading labels…
                  </div>
                ) : ghLabels.length === 0 ? (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                    No eligible labels found. Switch to a custom label instead.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {ghLabels.map((gl) => {
                      const active = ghLabel === gl.name.toLowerCase();
                      return (
                        <button
                          key={gl.name}
                          type="button"
                          onClick={() => {
                            setGhLabel(gl.name.toLowerCase());
                            setError('');
                          }}
                          className={cn(
                            'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                            active ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accent'
                          )}
                        >
                          <span
                            className="size-3.5 shrink-0 rounded-full ring-1 ring-black/10"
                            style={{ backgroundColor: `#${gl.color}` }}
                          />
                          <span className="truncate font-mono font-semibold text-foreground">
                            {gl.name}
                          </span>
                          {active && (
                            <Check
                              className="ml-auto size-4 shrink-0 text-primary"
                              strokeWidth={2.5}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-52 flex-col justify-center space-y-1.5">
                <Label htmlFor="tier-label" className="text-sm font-semibold">
                  Label name
                </Label>
                <Input
                  ref={customRef}
                  id="tier-label"
                  placeholder="e.g. critical"
                  value={customLabel}
                  disabled={saving}
                  onChange={(e) => {
                    setCustomLabel(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                  className="h-10 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Must exactly match the label on your GitHub issues.
                </p>
              </div>
            )}

            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="tier-amount" className="text-sm font-semibold">
                Payout amount
              </Label>
              <InputGroup className="h-11">
                <InputGroupInput
                  id="tier-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  disabled={saving}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submit();
                  }}
                  className="font-mono text-lg font-bold"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupText className="text-xs font-semibold">USDC</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
            </div>

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}
          </div>

          <DialogFooter className="mt-0">
            <AppButton
              variant="outline"
              size="sm"
              onClick={() => !saving && setOpen(false)}
              disabled={saving}
              className="w-full sm:w-auto"
            >
              Discard
            </AppButton>
            <AppButton
              variant="solid"
              size="sm"
              onClick={submit}
              disabled={saving}
              className="w-full sm:w-auto sm:min-w-28"
            >
              {saving ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  Saving
                </>
              ) : (
                'Save'
              )}
            </AppButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
