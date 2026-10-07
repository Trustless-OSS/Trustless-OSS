'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, GitMerge, Lock, Tag, UserPlus } from 'lucide-react';
import { formatWhen } from '@/app/components/dashboard/MaintainerActivity';
import { cn } from '@/lib/utils';
import { authHeaders, backendUrl } from '@/lib/backend';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  isRead: boolean;
  refId: string | null;
  data: Record<string, unknown> | null;
  createdAt: string;
};

// ─── Icon / colour map ────────────────────────────────────────────────────────

const KIND_ICON: Record<string, typeof Bell> = {
  rewarded: Tag,
  locked: Lock,
  released: GitMerge,
  assigned: UserPlus,
};

const KIND_TONE: Record<string, string> = {
  rewarded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  locked: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  released: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  assigned: 'bg-muted text-muted-foreground dark:bg-white/10 dark:text-foreground',
};

function iconFor(kind: string) {
  return KIND_ICON[kind] ?? Bell;
}

function toneFor(kind: string) {
  return KIND_TONE[kind] ?? 'bg-muted text-muted-foreground';
}

// ─── API helpers ──────────────────────────────────────────────────────────────

function normalizeNotice(raw: Record<string, unknown>): Notice {
  return {
    id: String(raw.id ?? ''),
    kind: String(raw.kind ?? ''),
    title: String(raw.title ?? ''),
    body: String(raw.body ?? ''),
    isRead: Boolean(raw.isRead ?? raw.is_read ?? false),
    refId: raw.refId != null ? String(raw.refId) : null,
    data:
      raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)
        ? (raw.data as Record<string, unknown>)
        : null,
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
  };
}

async function fetchNotifications(token: string): Promise<Notice[]> {
  const res = await fetch(backendUrl('/notifications'), {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const json = await res.json();
  const raw: unknown[] = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : [];
  return raw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map(normalizeNotice);
}

async function fetchUnreadCount(token: string): Promise<number> {
  const res = await fetch(backendUrl('/notifications/unread-count'), {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  if (!res.ok) return 0;
  const json = await res.json();
  return Number(json?.count ?? json?.unread_count ?? json?.data?.count ?? 0);
}

async function apiReadAll(token: string): Promise<void> {
  await fetch(backendUrl('/notifications/read-all'), {
    method: 'POST',
    headers: authHeaders(token),
  });
}

async function apiReadOne(token: string, id: string): Promise<void> {
  await fetch(backendUrl(`/notifications/${id}/read`), {
    method: 'POST',
    headers: authHeaders(token),
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 30_000;

export default function NotificationBell({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const openedOnce = useRef(false);

  // Poll unread count every 30 s
  const refreshUnread = useCallback(async () => {
    if (!token) return;
    const count = await fetchUnreadCount(token);
    setUnread(count);
  }, [token]);

  useEffect(() => {
    refreshUnread();
    const id = setInterval(refreshUnread, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refreshUnread]);

  // Load full list only when panel first opens
  async function loadNotifications() {
    if (!token || openedOnce.current) return;
    openedOnce.current = true;
    setLoading(true);
    const data = await fetchNotifications(token);
    setItems(data);
    setUnread(data.filter((n) => !n.isRead).length);
    setLoading(false);
  }

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) loadNotifications();
  }

  // Close on outside click / Escape
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  async function markAllRead() {
    setItems((curr) => curr.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    if (token) await apiReadAll(token);
  }

  async function markRead(id: string) {
    setItems((curr) => curr.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setUnread((prev) => Math.max(0, prev - 1));
    if (token) await apiReadOne(token, id);
  }

  // Build a link for each notification based on its data payload
  function hrefFor(notice: Notice): string {
    const repoId = notice.data?.repoId ?? notice.data?.repo_id;
    if (repoId) return `/dashboard/${repoId}`;
    return '/dashboard/transactions';
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-accent hover:shadow-md"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
            <div>
              <p className="text-sm font-bold">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unread > 0 ? `${unread} unread` : 'You are caught up'}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="text-xs font-semibold text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            >
              Mark all read
            </button>
          </div>

          {/* Body */}
          {loading ? (
            <p className="px-4 py-10 text-center text-sm font-medium text-muted-foreground">
              Loading…
            </p>
          ) : items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm font-medium text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {items.map((notice) => {
                const Icon = iconFor(notice.kind);
                return (
                  <li key={notice.id}>
                    <Link
                      href={hrefFor(notice)}
                      onClick={() => {
                        if (!notice.isRead) markRead(notice.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex gap-3 px-4 py-3 transition-colors hover:bg-accent',
                        notice.isRead ? 'opacity-80' : 'bg-primary/5'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          toneFor(notice.kind)
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {notice.title}
                          </span>
                          {!notice.isRead && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                          {notice.body}
                        </span>
                        <time className="mt-1 block text-xs text-muted-foreground">
                          {formatWhen(notice.createdAt)}
                        </time>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="border-t border-border/70 px-4 py-2.5">
            <Link
              href="/dashboard/transactions"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-primary hover:underline"
            >
              View activity
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
