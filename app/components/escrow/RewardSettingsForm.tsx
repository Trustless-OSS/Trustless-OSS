'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { notifySuccess, handleError } from '@/lib/notifications';
import AppButton from '@/app/components/ui/Button';
import LoadingLogo from '@/app/components/layout/LoadingLogo';
import { authHeaders, backendUrl } from '@/lib/backend';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewardLevel { label: string; amount: number }
interface GitHubLabel { name: string; color: string; description?: string | null }
interface RewardSettingsFormProps { repoId: string; token: string; initialLevels: RewardLevel[] }

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

const fmt = (v: string) => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : v; };

async function apiUpsert(repoId: string, token: string, label: string, amount: number) {
  const r = await fetch(backendUrl(`/repos/${repoId}/rewards`), { method: 'PUT', headers: authHeaders(token), body: JSON.stringify({ label, amount }) });
  if (!r.ok) { const t = await r.text().catch(() => ''); let m = `HTTP ${r.status}`; try { m = ((JSON.parse(t) as { error?: string }).error ?? t) || m; } catch { if (t) m = t; } throw new Error(m); }
}

async function apiDelete(repoId: string, token: string, label: string, gh: boolean) {
  const r = await fetch(backendUrl(`/repos/${repoId}/rewards/${encodeURIComponent(label)}`), { method: 'DELETE', headers: authHeaders(token), body: JSON.stringify({ alsoDeleteGithubLabel: gh }) });
  if (!r.ok) { const t = await r.text().catch(() => ''); let m = `HTTP ${r.status}`; try { m = ((JSON.parse(t) as { error?: string }).error ?? t) || m; } catch { if (t) m = t; } throw new Error(m); }
}

async function apiGhLabels(repoId: string, token: string): Promise<GitHubLabel[]> {
  const r = await fetch(backendUrl(`/repos/${repoId}/github-labels`), { headers: authHeaders(token, false), cache: 'no-store' });
  if (!r.ok) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : (Array.isArray(j?.data) ? j.data : []);
}

// ─── Component ────────────────────────────────────────────────────────────────

type Mode = 'view' | 'edit' | 'delete';

export default function RewardSettingsForm({ repoId, token, initialLevels }: RewardSettingsFormProps) {
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
    if (changed.length === 0) { setMode('view'); return; }
    setBusy(true);
    try {
      for (const label of changed) {
        await apiUpsert(repoId, token, label, parseFloat(drafts[label]) || 0);
      }
      setSaved((p) => ({ ...p, ...Object.fromEntries(changed.map((l) => [l, drafts[l]])) }));
      setMode('view');
      notifySuccess('Rewards updated', `${changed.length} level${changed.length === 1 ? '' : 's'} saved.`);
    } catch (e) { console.error('[RewardForm] saveEdits:', e); handleError(e, 'Update Rewards'); }
    finally { setBusy(false); }
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
      setSaved((p) => { const n = { ...p }; checkedLabels.forEach((l) => delete n[l]); return n; });
      setDelConfirmOpen(false);
      setMode('view');
      notifySuccess('Levels removed', `${checkedLabels.length} removed${alsoGh ? ' from dapp + GitHub' : ''}.`);
    } catch (e) { console.error('[RewardForm] delete:', e); handleError(e, 'Delete Rewards'); }
    finally { setBusy(false); }
  }

  // ── Add flow (dialog) ──────────────────────────────────────────────────────
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

  useEffect(() => { if (addOpen && addMode === 'custom') setTimeout(() => newLabelRef.current?.focus(), 50); }, [addOpen, addMode]);

  const loadGhLabels = useCallback(async () => {
    setGhLoading(true);
    const list = await apiGhLabels(repoId, token);
    setGhLabels(list.filter((l) => !labels.includes(l.name.toLowerCase())));
    setGhLoading(false);
  }, [repoId, token, labels]);

  useEffect(() => { if (addOpen) loadGhLabels(); }, [addOpen, loadGhLabels]);

  function openAdd() { setMode('view'); setAddMode('pick'); setPickedLabel(''); setNewLabel(''); setNewAmount(''); setAddErr(''); setAddOpen(true); }
  function closeAdd() { if (adding) return; setAddOpen(false); }

  async function confirmAdd() {
    const lbl = (addMode === 'pick' ? pickedLabel : newLabel).trim().toLowerCase().replace(/\s+/g, '-');
    const amt = parseFloat(newAmount);
    if (!lbl) { setAddErr('Pick or enter a label.'); return; }
    if (labels.includes(lbl)) { setAddErr(`"${lbl}" already configured.`); return; }
    if (!Number.isFinite(amt) || amt < 0) { setAddErr('Enter a valid amount ≥ 0.'); return; }
    setAdding(true);
    try {
      await apiUpsert(repoId, token, lbl, amt);
      setSaved((p) => ({ ...p, [lbl]: String(amt) }));
      setLabels((p) => [...p, lbl]);
      setAddOpen(false);
      notifySuccess('Level added', `"${lbl}" → ${fmt(String(amt))} USDC`);
    } catch (e) { console.error('[RewardForm] add:', e); handleError(e, 'Add Level'); }
    finally { setAdding(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <section aria-labelledby="reward-params-heading">
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="reward-params-heading" className="text-xl font-black tracking-tight text-foreground">
          Reward parameters
        </h2>

        <div className="flex items-center gap-2">
          {mode === 'view' && (
            <>
              {labels.length > 0 && (
                <>
                  <Button type="button" variant="outline" size="sm" onClick={enterEdit} className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold">
                    <Pencil className="size-3.5" strokeWidth={2.5} />
                    Edit
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={enterDelete} className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold text-destructive hover:border-destructive/50 hover:bg-destructive/5 hover:text-destructive">
                    <Trash2 className="size-3.5" strokeWidth={2.5} />
                    Delete
                  </Button>
                </>
              )}
              <Button type="button" variant="outline" size="sm" onClick={openAdd} className="h-8 gap-1.5 rounded-lg border-dashed px-3 text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-foreground">
                <Plus className="size-3.5" strokeWidth={2.5} />
                Add level
              </Button>
            </>
          )}

          {mode === 'edit' && (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('view')} disabled={busy} className="h-8 gap-1.5 px-3 text-xs font-semibold">
                <X className="size-3.5" strokeWidth={2.5} />
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveEdits} disabled={busy} className="h-8 gap-1.5 px-3 text-xs font-semibold">
                {busy ? <LoadingLogo size="tiny" variant="circle" /> : <Check className="size-3.5" strokeWidth={2.5} />}
                Save changes
              </Button>
            </>
          )}

          {mode === 'delete' && (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('view')} disabled={busy} className="h-8 gap-1.5 px-3 text-xs font-semibold">
                <X className="size-3.5" strokeWidth={2.5} />
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={() => setDelConfirmOpen(true)} disabled={busy || checkedLabels.length === 0}
                className="h-8 gap-1.5 px-3 text-xs font-semibold !bg-destructive !text-white hover:!bg-destructive/90 disabled:!bg-muted disabled:!text-muted-foreground">
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
            <div
              key={key}
              className={cn(
                'flex min-h-[4.5rem] flex-col justify-between rounded-2xl border-l-4 px-4 py-3 ring-1 transition-all',
                pal(i).accent,
                mode === 'delete' && isChecked ? 'ring-2 ring-destructive/60' : 'ring-border/50',
                mode === 'delete' && 'cursor-pointer'
              )}
              onClick={mode === 'delete' ? () => setChecked((c) => ({ ...c, [key]: !c[key] })) : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{key}</p>
                {mode === 'delete' && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => setChecked((c) => ({ ...c, [key]: e.target.checked }))}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${key} for removal`}
                    className="h-4 w-4 shrink-0 accent-destructive"
                  />
                )}
              </div>

              <div className="mt-2 flex items-center gap-2">
                {mode === 'edit' ? (
                  <Input
                    type="number" inputMode="decimal" step="0.01" min="0"
                    value={drafts[key] ?? ''}
                    disabled={busy}
                    aria-label={`${key} reward in USDC`}
                    onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                    className="h-9 border-0 bg-transparent px-0 font-mono text-2xl font-black shadow-none focus-visible:ring-0"
                  />
                ) : (
                  <p className="font-mono text-2xl font-black tracking-tight text-foreground tabular-nums">{fmt(saved[key] ?? '0')}</p>
                )}
                <span className="shrink-0 text-sm font-semibold text-muted-foreground">USDC</span>
              </div>
            </div>
          );
        })}

        {labels.length === 0 && (
          <p className="col-span-full rounded-2xl border border-dashed border-border/70 px-4 py-8 text-center text-sm text-muted-foreground">
            No levels yet — click <strong className="text-foreground">Add level</strong> to get started.
          </p>
        )}
      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={delConfirmOpen} onOpenChange={(o) => { if (!o && !busy) setDelConfirmOpen(false); }}>
        <AlertDialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-md">
          <AlertDialogHeader className="gap-3 p-5 sm:p-6">
            <AlertDialogMedia className="mb-0 size-12 rounded-2xl bg-destructive/10 text-destructive">
              <Trash2 className="size-5" strokeWidth={2.25} />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-display text-xl font-extrabold tracking-tight">
              Remove {checkedLabels.length} level{checkedLabels.length === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-6">
              {checkedLabels.join(', ')} — issues with {checkedLabels.length === 1 ? 'this label' : 'these labels'} will no longer earn a bounty.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-5 pb-2 sm:px-6">
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3 hover:bg-muted/60">
              <input type="checkbox" checked={alsoGh} onChange={(e) => setAlsoGh(e.target.checked)} disabled={busy} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
              <div>
                <p className="text-sm font-semibold">Also delete from GitHub</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Permanently removes the matching label{checkedLabels.length === 1 ? '' : 's'} from the repo.</p>
              </div>
            </label>
          </div>
          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <AppButton variant="outline" size="sm" onClick={() => setDelConfirmOpen(false)} disabled={busy} className="w-full sm:w-auto">Cancel</AppButton>
            <AppButton variant="solid" size="sm" onClick={confirmDelete} disabled={busy} className="w-full sm:min-w-28 sm:w-auto !bg-destructive !text-white hover:!bg-destructive/90">
              {busy ? <><LoadingLogo size="tiny" variant="circle" />Removing</> : 'Remove'}
            </AppButton>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add dialog */}
      <AlertDialog open={addOpen} onOpenChange={(o) => { if (!o) closeAdd(); }}>
        <AlertDialogContent className="gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-lg">
          <AlertDialogHeader className="gap-3 p-5 sm:p-6">
            <AlertDialogMedia className="mb-0 size-12 rounded-2xl bg-primary/10 text-primary">
              <Tag className="size-5" strokeWidth={2.25} />
            </AlertDialogMedia>
            <AlertDialogTitle className="font-display text-xl font-extrabold tracking-tight">Add bounty tier</AlertDialogTitle>
            <AlertDialogDescription className="text-left text-sm leading-5">
              Link a label to a USDC amount.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 px-5 pb-2 sm:px-6">
            <Tabs value={addMode} onValueChange={(v) => { setAddMode(v as 'pick' | 'custom'); setAddErr(''); }} className="gap-4">
              <TabsList className="w-full">
                <TabsTrigger value="pick">From GitHub</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>

              <TabsContent value="pick">
                <div className="h-52 overflow-y-auto rounded-xl border border-border bg-muted/30 p-1.5">
                  {ghLoading ? (
                    <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                      <LoadingLogo size="tiny" variant="circle" /> Loading…
                    </div>
                  ) : ghLabels.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                      No labels. Use Custom.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {ghLabels.map((gl) => {
                        const active = pickedLabel === gl.name.toLowerCase();
                        return (
                          <button key={gl.name} type="button" onClick={() => { setPickedLabel(gl.name.toLowerCase()); setAddErr(''); }}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                              active ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-accent'
                            )}>
                            <span className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ backgroundColor: `#${gl.color}` }} />
                            <span className="truncate font-mono font-semibold text-foreground">{gl.name}</span>
                            {active && <Check className="ml-auto size-4 shrink-0 text-primary" strokeWidth={2.5} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="custom">
                <div className="flex h-52 flex-col justify-center space-y-1.5">
                  <Label htmlFor="add-label-name" className="text-sm font-semibold">Label name</Label>
                  <Input ref={newLabelRef} id="add-label-name" placeholder="e.g. critical"
                    value={newLabel} disabled={adding}
                    onChange={(e) => { setNewLabel(e.target.value); setAddErr(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') confirmAdd(); }}
                    className="h-10 font-mono text-sm" />
                  <p className="text-xs text-muted-foreground">Must match the GitHub label.</p>
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-1.5">
              <Label htmlFor="add-label-amount" className="text-sm font-semibold">Amount (USDC)</Label>
              <div className="relative">
                <Input id="add-label-amount" type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00"
                  value={newAmount} disabled={adding}
                  onChange={(e) => { setNewAmount(e.target.value); setAddErr(''); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmAdd(); }}
                  className="h-10 pr-14 font-mono text-lg font-bold" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">USDC</span>
              </div>
            </div>

            {addErr && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">{addErr}</p>
            )}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 border-t border-border/70 bg-muted/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-6">
            <AppButton variant="outline" size="sm" onClick={closeAdd} disabled={adding} className="w-full sm:w-auto">Cancel</AppButton>
            <AppButton variant="solid" size="sm" onClick={confirmAdd} disabled={adding} className="w-full sm:min-w-28 sm:w-auto">
              {adding ? <><LoadingLogo size="tiny" variant="circle" />Adding</> : 'Add level'}
            </AppButton>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
