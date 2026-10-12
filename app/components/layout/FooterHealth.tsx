'use client';

import { useEffect, useState } from 'react';
import {
  fetchBackendHealth,
  STATUS_PAGE_URL,
  type HealthSnapshot,
  type HealthStatus,
} from '@/lib/health';
import { Status, StatusIndicator, StatusLabel, type StatusProps } from '@/components/ui/status';

const POLL_MS = 4 * 60 * 1000;
const WAKING_HINT_MS = 2500;

// Maps our live health states onto the shadcn Status badge's four variants.
// The badge renders its own label (Online/Offline/Maintenance/Degraded) per variant.
const STATUS_VARIANT: Record<HealthStatus, StatusProps['status']> = {
  checking: 'maintenance',
  waking: 'degraded',
  ok: 'online',
  down: 'offline',
};

export default function FooterHealth() {
  const [status, setStatus] = useState<HealthStatus>('checking');
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      if (document.visibilityState === 'hidden') return;

      setStatus((current) => (current === 'ok' ? current : 'checking'));
      const wakingId = window.setTimeout(() => {
        if (!cancelled) {
          setStatus((current) => (current === 'checking' ? 'waking' : current));
        }
      }, WAKING_HINT_MS);

      const next = await fetchBackendHealth();
      window.clearTimeout(wakingId);
      if (cancelled) return;

      setSnapshot(next);
      setStatus(next.status);
    };

    void ping();

    const pollId = window.setInterval(() => {
      void ping();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void ping();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      if (pollId !== undefined) window.clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <a
      href={STATUS_PAGE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-live="polite"
      title={snapshot?.message ?? 'Open public status page'}
    >
      <Status
        status={STATUS_VARIANT[status]}
        className="gap-2.5 px-3.5 py-1.5 text-sm transition-colors"
      >
        <StatusIndicator className="h-2.5 w-2.5" />
        <StatusLabel />
      </Status>
    </a>
  );
}
