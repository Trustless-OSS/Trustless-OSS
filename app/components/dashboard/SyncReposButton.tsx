'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { handleError, notifySuccess } from '@/lib/notifications';
import { backendUrl } from '@/lib/backend';
import Button from '@/app/components/ui/Button';

async function readError(response: Response, fallback: string) {
  const text = await response.text();
  try {
    const payload = JSON.parse(text) as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  } catch {
    /* body was not JSON */
  }
  const trimmed = text.replace(/\s+/g, ' ').trim().slice(0, 180);
  return trimmed || fallback;
}

async function syncRepositories(token: string, installationIds: number[]) {
  if (installationIds.length === 0) {
    throw new Error('Connect a GitHub repository first, then sync again.');
  }

  for (const installationId of installationIds) {
    const response = await fetch(backendUrl('/api/repos/sync-installation'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ installationId }),
    });
    if (!response.ok) {
      throw new Error(await readError(response, 'Failed to sync repositories'));
    }
  }
}

export default function SyncReposButton({
  token,
  installationIds,
}: {
  token: string;
  installationIds: number[];
}) {
  const [syncing, setSyncing] = useState(false);
  const router = useRouter();

  async function handleSync() {
    if (!token) {
      handleError(new Error('Sign in again to sync repositories.'), 'Sync repositories');
      return;
    }

    setSyncing(true);
    try {
      await syncRepositories(token, installationIds);
      notifySuccess('Repositories synced', 'GitHub repositories are up to date.');
      router.refresh();
    } catch (error) {
      handleError(error, 'Sync repositories');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="md"
      onClick={handleSync}
      disabled={syncing}
      aria-busy={syncing}
      aria-label="Sync"
      title="Sync"
      className="h-10 w-10 shrink-0 rounded-md border-sky-200 bg-sky-50 px-0 text-sky-700 shadow-none hover:border-sky-300 hover:bg-sky-100 hover:text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20"
    >
      <RefreshCw
        className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`}
        strokeWidth={2}
        aria-hidden="true"
      />
    </Button>
  );
}
