'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
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
  {
    accent: 'border-l-emerald-400 bg-emerald-50/80 dark:bg-emerald-500/12',
    media: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-400/60',
  },
  {
    accent: 'border-l-amber-400 bg-amber-50/80 dark:bg-amber-500/12',
    media: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400/60',
  },
  {
    accent: 'border-l-rose-400 bg-rose-50/80 dark:bg-rose-500/12',
    media: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-400/60',
  },
  {
    accent: 'border-l-violet-400 bg-violet-50/80 dark:bg-violet-500/12',
    media: 'bg-violet-500/15 text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-400/60',
  },
  {
    accent: 'border-l-cyan-400 bg-cyan-50/80 dark:bg-cyan-500/12',
    media: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300',
    ring: 'ring-cyan-400/60',
  },
];
const pal = (i: number) => PALETTE[i % PALETTE.length];

// ─── Utils ────────────────────────────────────────────────────────────────────

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fmt = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n)
    ? n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : v;
};
const authH = (t: string) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

async function apiUpsert(repoId: string, token: string, label: string, amount: number) {
  const r = await fetch(backendUrl(`/repos/${repoId}/rewards`), {
    method: 'PUT',
    headers: authH(token),
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
    headers: authH(token),
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
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : [];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RewardSettingsForm({
  repoId,
  token,
  initialLevels,
}: RewardSettingsFormProps) {
  const [labels, setLabels] = useState(() => initialLevels.map((r) => r.label));
  const [saved, setSaved] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialLevels.map((r) => [r.label, String(r.amount)]))
  );

  // ── Edit flow: pick → edit amount → confirm ──────────────────────────────
  type EditStep = 'pick' | 'edit' | 'confirm';
  const [editOpen, setEditOpen] = useState(false);
  const [editStep, setEditStep] = useState<EditStep>('pick');
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editStep === 'edit')
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 50);
  }, [editStep]);

  function openEdit() {
    setEditStep('pick');
    setEditKey(null);
    setEditDraft('');
    setEditOpen(true);
  }
  function closeEdit() {
    if (saving) return;
    setEditOpen(false);
  }
  function pickEditKey(key: string) {
    setEditKey(key);
    setEditDraft(saved[key] ?? '0');
    setEditStep('edit');
  }
  function submitEditAmount() {
    const v = editDraft.trim() === '' ? '0' : editDraft;
    if (v === (saved[editKey!] ?? '0')) {
      closeEdit();
      return;
    }
    setEditDraft(v);
    setEditStep('confirm');
  }

  async function confirmEdit() {
    if (!editKey) return;
    setSaving(true);
    try {
      await apiUpsert(repoId, token, editKey, parseFloat(editDraft) || 0);
      setSaved((p) => ({ ...p, [editKey!]: editDraft }));
      setEditOpen(false);
      notifySuccess('Reward updated', `${cap(editKey)} → ${fmt(editDraft)} USDC`);
    } catch (e) {
      console.error('[RewardForm] edit:', e);
      handleError(e, 'Update Reward');
    } finally {
      setSaving(false);
    }
  }

  function handleEditKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitEditAmount();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setEditStep('pick');
    }
  }

  // ── Delete flow: pick → confirm ───────────────────────────────────────────
  const [delOpen, setDelOpen] = useState(false);
  const [delStep, setDelStep] = useState<'pick' | 'confirm'>('pick');
  const [delKey, setDelKey] = useState<string | null>(null);
  const [alsoGh, setAlsoGh] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function openDel() {
    setDelStep('pick');
    setDelKey(null);
    setAlsoGh(false);
    setDelOpen(true);
  }
  function closeDel() {
    if (deleting) return;
    setDelOpen(false);
  }
  function pickDelKey(key: string) {
    setDelKey(key);
    setDelStep('confirm');
  }

  async function confirmDel() {
    if (!delKey) return;
    setDeleting(true);
    try {
      await apiDelete(repoId, token, delKey, alsoGh);
      setLabels((p) => p.filter((l) => l !== delKey));
      setSaved((p) => {
        const n = { ...p };
        delete n[delKey!];
        return n;
      });
      setDelOpen(false);
      notifySuccess(
        'Level removed',
        `"${delKey}"${alsoGh ? ' removed from dapp + GitHub' : ' removed from dapp'}`
      );
    } catch (e) {
      console.error('[RewardForm] delete:', e);
      handleError(e, 'Delete Reward');
    } finally {
      setDeleting(false);
    }
  }

  // ── Add flow ──────────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<'pick' | 'custom'>('pick');
  const [ghLabels, setGhLabels] = useState<GitHubLabel[]>([]);
  const [ghLoading, setGhLoading] = useState(false);
  const [pickedLabel, setPickedLabel] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [addErr, setAddErr] = useState('');
  const [adding, setAdding] = useState(false);
  const newLabelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (addOpen && addMode === 'custom') setTimeout(() => newLabelRef.current?.focus(), 50);
  }, [addOpen, addMode]);

  const loadGhLabels = useCallback(async () => {
    setGhLoading(true);
    const list = await apiGhLabels(repoId, token);
    setGhLabels(list.filter((l) => !labels.includes(l.name.toLowerCase())));
    setGhLoading(false);
  }, [repoId, token, labels]);

  useEffect(() => {
    if (addOpen) loadGhLabels();
  }, [addOpen, loadGhLabels]);

  function openAdd() {
    setAddMode('pick');
    setPickedLabel('');
    setNewLabel('');
    setNewAmount('');
    setAddErr('');
    setAddOpen(true);
  }
  function closeAdd() {
    if (adding) return;
    setAddOpen(false);
  }

  async function confirmAdd() {
    const lbl = (addMode === 'pick' ? pickedLabel : newLabel)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-');
    const amt = parseFloat(newAmount);
    if (!lbl) {
      setAddErr('Pick or enter a label.');
      return;
    }
    if (labels.includes(lbl)) {
      setAddErr(`"${lbl}" already configured.`);
      return;
    }
    if (!Number.isFinite(amt) || amt < 0) {
      setAddErr('Enter a valid amount ≥ 0.');
      return;
    }
    setAdding(true);
    try {
      await apiUpsert(repoId, token, lbl, amt);
      setSaved((p) => ({ ...p, [lbl]: String(amt) }));
      setLabels((p) => [...p, lbl]);
      setAddOpen(false);
      notifySuccess('Level added', `"${lbl}" → ${fmt(String(amt))} USDC`);
    } catch (e) {
      console.error('[RewardForm] add:', e);
      handleError(e, 'Add Level');
    } finally {
      setAdding(false);
    }
  }

  // ── Helpers for edit confirm ──────────────────────────────────────────────
  const editPalette = editKey ? pal(labels.indexOf(editKey)) : PALETTE[0];
  const fromAmt = editKey ? fmt(saved[editKey] ?? '0') : '—';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="reward-params-heading">
      {/* Header row */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="reward-params-heading"
          className="text-xl font-black tracking-tight text-foreground"
        >
          Reward parameters
        </h2>
        <div className="flex items-center gap-2">
          {labels.length > 0 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openEdit}
                className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold"
              >
                <Pencil className="size-3.5" strokeWidth={2.5} />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openDel}
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
            onClick={openAdd}
            className="h-8 gap-1.5 rounded-lg border-dashed px-3 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground"
          >
            <Plus className="size-3.5" strokeWidth={2.5} />
            Add level
          </Button>
        </div>
      </div>

      {/* Read-only cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {labels.map((key, i) => (
          <div
            key={key}
            className={cn(
              'flex min-h-[4.5rem] flex-col justify-between rounded-2xl border-l-4 px-4 py-3 ring-1 ring-border/50',
              pal(i).accent
            )}
          >
            <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              {key}
            </p>
            <p className="mt-2 font-mono text-2xl font-black tracking-tight text-foreground tabular-nums">
              {fmt(saved[key] ?? '0')}
              <span className="ml-1 text-sm font-semibold text-muted-foreground">USDC</span>
            </p>
          </div>
        ))}

        {labels.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No levels yet — click <strong className="text-foreground">Add level</strong> to get
            started.
          </p>
        )}
      </div>

      {/* ── EDIT dialog ────────────────────────────────────────────────────── */}
      <AlertDialog
        open={editOpen}
        onOpenChange={(o) => {
          if (!o) closeEdit();
        }}
      >
        <AlertDialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
          <AlertDialogHeader className="gap-3 p-5 sm:p-6">
            <AlertDialogMedia
              className={cn(
                'mb-0 size-12 rounded-2xl',
                editStep === 'pick' ? 'bg-primary/10 text-primary' : editPalette.media
              )}
            >
              <Pencil className="size-5" strokeWidth={2.25} />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-display text-xl font-extrabold tracking-tight">
              {editStep === 'pick'
                ? 'Which level to edit?'
                : editStep === 'edit'
                  ? `Edit "${editKey}"`
                  : `Confirm change`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-6">
              {editStep === 'pick' && 'Select a reward level to update its USDC amount.'}
              {editStep === 'edit' &&
                'Set the new bounty amount. New issues pick this up immediately; existing ones keep their original.'}
              {editStep === 'confirm' && `Changes "${editKey}" bounty for new issues only.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="px-5 pb-2 sm:px-6">
            {/* Step 1 — pick card */}
            {editStep === 'pick' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {labels.map((key, i) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickEditKey(key)}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border-l-4 px-4 py-3 text-left ring-1 ring-border/50 transition-all hover:ring-2',
                      pal(i).accent,
                      pal(i).ring
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {key}
                      </p>
                      <p className="font-mono text-lg font-black tabular-nums">
                        {fmt(saved[key] ?? '0')}{' '}
                        <span className="text-xs font-semibold text-muted-foreground">USDC</span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Step 2 — edit amount */}
            {editStep === 'edit' && (
              <div className="space-y-3">
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border-l-4 px-4 py-3 ring-1',
                    editPalette.accent,
                    editPalette.ring
                  )}
                >
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                      {editKey}
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        ref={editInputRef}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        value={editDraft}
                        disabled={saving}
                        onChange={(e) => setEditDraft(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        className="h-8 border-0 bg-transparent px-0 font-mono text-xl font-black shadow-none focus-visible:ring-0"
                      />
                      <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                        USDC
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press{' '}
                  <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">
                    Enter
                  </kbd>{' '}
                  to continue or{' '}
                  <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">
                    Esc
                  </kbd>{' '}
                  to go back.
                </p>
              </div>
            )}

            {/* Step 3 — confirm */}
            {editStep === 'confirm' && (
              <div className="flex items-center gap-3 rounded-2xl bg-muted/70 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    Now
                  </p>
                  <p className="mt-1 font-mono text-lg font-black tabular-nums">
                    {fromAmt}{' '}
                    <span className="text-xs font-semibold text-muted-foreground">USDC</span>
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 text-right">
                  <p className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                    New
                  </p>
                  <p className="mt-1 font-mono text-lg font-black text-primary tabular-nums">
                    {fmt(editDraft)}{' '}
                    <span className="text-xs font-semibold text-muted-foreground">USDC</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <AppButton
              variant="outline"
              size="sm"
              onClick={
                editStep === 'edit'
                  ? () => setEditStep('pick')
                  : editStep === 'confirm'
                    ? () => setEditStep('edit')
                    : closeEdit
              }
              disabled={saving}
              className="w-full sm:w-auto"
            >
              {editStep === 'pick' ? 'Cancel' : 'Back'}
            </AppButton>
            {editStep === 'edit' && (
              <AppButton
                variant="solid"
                size="sm"
                onClick={submitEditAmount}
                disabled={saving}
                className="w-full sm:min-w-28 sm:w-auto"
              >
                Next
              </AppButton>
            )}
            {editStep === 'confirm' && (
              <AppButton
                variant="solid"
                size="sm"
                onClick={confirmEdit}
                disabled={saving}
                className="w-full sm:min-w-28 sm:w-auto"
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
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── DELETE dialog ───────────────────────────────────────────────────── */}
      <AlertDialog
        open={delOpen}
        onOpenChange={(o) => {
          if (!o) closeDel();
        }}
      >
        <AlertDialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
          <AlertDialogHeader className="gap-3 p-5 sm:p-6">
            <AlertDialogMedia className="mb-0 size-12 rounded-2xl bg-destructive/10 text-destructive">
              <Trash2 className="size-5" strokeWidth={2.25} />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-display text-xl font-extrabold tracking-tight">
              {delStep === 'pick' ? 'Which level to remove?' : `Remove "${delKey}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-6">
              {delStep === 'pick'
                ? 'Choose the reward level you want to delete.'
                : 'Issues with this label will no longer earn a bounty.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="px-5 pb-2 sm:px-6">
            {delStep === 'pick' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {labels.map((key, i) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pickDelKey(key)}
                    className={cn(
                      'flex items-center gap-3 rounded-2xl border-l-4 px-4 py-3 text-left ring-1 ring-border/50 transition-all hover:ring-2 hover:ring-destructive/40',
                      pal(i).accent
                    )}
                  >
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                        {key}
                      </p>
                      <p className="font-mono text-lg font-black tabular-nums">
                        {fmt(saved[key] ?? '0')}{' '}
                        <span className="text-xs font-semibold text-muted-foreground">USDC</span>
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {delStep === 'confirm' && (
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 hover:bg-muted/60">
                <input
                  type="checkbox"
                  checked={alsoGh}
                  onChange={(e) => setAlsoGh(e.target.checked)}
                  disabled={deleting}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <div>
                  <p className="text-sm font-semibold">Also delete from GitHub</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Permanently removes <code className="rounded bg-muted px-1">{delKey}</code> from
                    the repo's GitHub labels.
                  </p>
                </div>
              </label>
            )}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <AppButton
              variant="outline"
              size="sm"
              onClick={delStep === 'confirm' ? () => setDelStep('pick') : closeDel}
              disabled={deleting}
              className="w-full sm:w-auto"
            >
              {delStep === 'pick' ? 'Cancel' : 'Back'}
            </AppButton>
            {delStep === 'confirm' && (
              <AppButton
                variant="solid"
                size="sm"
                onClick={confirmDel}
                disabled={deleting}
                className="w-full sm:min-w-28 sm:w-auto !bg-destructive !text-white hover:!bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <LoadingLogo size="tiny" variant="circle" />
                    Removing
                  </>
                ) : (
                  'Remove'
                )}
              </AppButton>
            )}
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── ADD dialog ──────────────────────────────────────────────────────── */}
      <AlertDialog
        open={addOpen}
        onOpenChange={(o) => {
          if (!o) closeAdd();
        }}
      >
        <AlertDialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
          <AlertDialogHeader className="gap-3 p-5 sm:p-6">
            <AlertDialogMedia className="mb-0 size-12 rounded-2xl bg-primary/10 text-primary">
              <Tag className="size-5" strokeWidth={2.25} />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-display text-xl font-extrabold tracking-tight">
              New reward level
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-6">
              Map a GitHub label to a USDC bounty. Label name must match exactly.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 px-5 pb-2 sm:px-6">
            {/* Mode tabs */}
            <div className="flex overflow-hidden rounded-xl border border-border text-sm font-semibold">
              {(['pick', 'custom'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setAddMode(m);
                    setAddErr('');
                  }}
                  className={cn(
                    'flex-1 py-2 transition-colors',
                    addMode === m
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  {m === 'pick' ? 'From GitHub' : 'Custom'}
                </button>
              ))}
            </div>

            {/* Pick from GitHub */}
            {addMode === 'pick' && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                  Repo labels
                </p>
                {ghLoading ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">Fetching…</p>
                ) : ghLabels.length === 0 ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    No unassigned labels — switch to Custom.
                  </p>
                ) : (
                  <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-border p-1">
                    {ghLabels.map((gl) => (
                      <button
                        key={gl.name}
                        type="button"
                        onClick={() => {
                          setPickedLabel(gl.name.toLowerCase());
                          setAddErr('');
                        }}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent',
                          pickedLabel === gl.name.toLowerCase() &&
                            'bg-primary/10 ring-1 ring-primary/30'
                        )}
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full border border-black/10"
                          style={{ backgroundColor: `#${gl.color}` }}
                        />
                        <span className="font-mono font-semibold">{gl.name}</span>
                        {gl.description && (
                          <span className="truncate text-xs text-muted-foreground">
                            {gl.description}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Custom label */}
            {addMode === 'custom' && (
              <div className="space-y-1.5">
                <Label htmlFor="add-label-name" className="text-sm font-semibold">
                  Label name
                </Label>
                <Input
                  ref={newLabelRef}
                  id="add-label-name"
                  placeholder="e.g. critical, good-first-issue"
                  value={newLabel}
                  disabled={adding}
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    setAddErr('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmAdd();
                  }}
                  className="h-9 font-mono text-sm"
                />
              </div>
            )}

            {/* Amount — always */}
            <div className="space-y-1.5">
              <Label htmlFor="add-label-amount" className="text-sm font-semibold">
                Amount (USDC)
              </Label>
              <div className="relative">
                <Input
                  id="add-label-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newAmount}
                  disabled={adding}
                  onChange={(e) => {
                    setNewAmount(e.target.value);
                    setAddErr('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmAdd();
                  }}
                  className="h-9 pr-14 font-mono text-sm"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  USDC
                </span>
              </div>
            </div>

            {addErr && <p className="text-sm font-semibold text-destructive">{addErr}</p>}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <AppButton
              variant="outline"
              size="sm"
              onClick={closeAdd}
              disabled={adding}
              className="w-full sm:w-auto"
            >
              Cancel
            </AppButton>
            <AppButton
              variant="solid"
              size="sm"
              onClick={confirmAdd}
              disabled={adding}
              className="w-full sm:min-w-28 sm:w-auto"
            >
              {adding ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  Adding
                </>
              ) : (
                'Add level'
              )}
            </AppButton>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
