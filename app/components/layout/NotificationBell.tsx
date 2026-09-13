'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, GitMerge, Lock, Tag, UserPlus } from 'lucide-react';
import { formatWhen } from '@/app/components/dashboard/MaintainerActivity';
import { cn } from '@/lib/utils';

type NoticeKind = 'rewarded' | 'locked' | 'released' | 'assigned';

export type MaintainerNotice = {
  id: string;
  title: string;
  body: string;
  at: string;
  href: string;
  kind: NoticeKind;
  read: boolean;
};

const KIND_ICON: Record<NoticeKind, typeof Bell> = {
  rewarded: Tag,
  locked: Lock,
  released: GitMerge,
  assigned: UserPlus,
};

const KIND_TONE: Record<NoticeKind, string> = {
  rewarded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  locked: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  released: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  assigned: 'bg-muted text-muted-foreground dark:bg-white/10 dark:text-foreground',
};

export const DEMO_NOTIFICATIONS: MaintainerNotice[] = [
  {
    id: 'ntf_05',
    title: 'Payout released',
    body: '220 USDC sent to @gaearon for #9.',
    at: '2026-09-04T12:10:00.000Z',
    href: '/dashboard/transactions',
    kind: 'released',
    read: false,
  },
  {
    id: 'ntf_04',
    title: 'Contributor assigned',
    body: '@ryzen-xp claimed #142 in trustless-oss/web.',
    at: '2026-09-04T10:58:00.000Z',
    href: '/dashboard/transactions',
    kind: 'assigned',
    read: false,
  },
  {
    id: 'ntf_03',
    title: 'Funds locked',
    body: '50 USDC escrowed for #128.',
    at: '2026-09-03T18:40:00.000Z',
    href: '/dashboard/transactions',
    kind: 'locked',
    read: false,
  },
  {
    id: 'ntf_02',
    title: 'Issue rewarded',
    body: '#128 was labeled and is ready for contributors.',
    at: '2026-09-02T14:05:00.000Z',
    href: '/dashboard/transactions',
    kind: 'rewarded',
    read: true,
  },
  {
    id: 'ntf_01',
    title: 'Pool deposit',
    body: '1,000 USDC locked into the web escrow.',
    at: '2026-08-18T13:40:00.000Z',
    href: '/dashboard/transactions',
    kind: 'locked',
    read: true,
  },
];

export function unreadCount(notices: MaintainerNotice[]) {
  return notices.filter((notice) => !notice.read).length;
}

export default function NotificationBell({
  notices = DEMO_NOTIFICATIONS,
}: {
  notices?: MaintainerNotice[];
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(notices);
  const panelRef = useRef<HTMLDivElement>(null);
  const unread = unreadCount(items);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function markAllRead() {
    setItems((current) => current.map((notice) => ({ ...notice, read: true })));
  }

  function markRead(id: string) {
    setItems((current) =>
      current.map((notice) => (notice.id === id ? { ...notice, read: true } : notice))
    );
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className="relative flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm transition-colors hover:border-primary/40 hover:bg-accent hover:shadow-md"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
        {unread > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Maintainer notifications"
          className="absolute right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10"
        >
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

          {items.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm font-medium text-muted-foreground">
              No maintainer alerts yet.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {items.map((notice) => {
                const Icon = KIND_ICON[notice.kind];
                return (
                  <li key={notice.id}>
                    <Link
                      href={notice.href}
                      onClick={() => {
                        markRead(notice.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex gap-3 px-4 py-3 transition-colors hover:bg-accent',
                        notice.read ? 'opacity-80' : 'bg-primary/5'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                          KIND_TONE[notice.kind]
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {notice.title}
                          </span>
                          {notice.read ? null : (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm leading-5 text-muted-foreground">
                          {notice.body}
                        </span>
                        <time className="mt-1 block text-xs text-muted-foreground">
                          {formatWhen(notice.at)}
                        </time>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

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
      ) : null}
    </div>
  );
}
