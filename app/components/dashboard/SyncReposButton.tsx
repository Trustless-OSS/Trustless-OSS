'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { handleError, notifySuccess } from '@/lib/notifications';
import { authHeaders, backendUrl } from '@/lib/backend';
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

function readGhToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)gh_token=([^;]*)/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

// The gh_token cookie that lets us read GitHub installations lives only 8 hours
// (see app/auth/callback/route.ts). A returning user hits an empty/expired cookie
// and used to get a dead-end "sign out and sign in again" error. Instead, silently
// re-run the same GitHub OAuth flow as login, redirecting back to this page so a
// fresh gh_token is minted. GitHub skips the consent screen since the app is already
// authorized, so this is a near-instant bounce, not a reinstall.
// ponytail: throws after redirect to stop execution; caller never resolves (page unloads).
async function reauthorizeGitHub(): Promise<never> {
  const { createClient } = await import('@/lib/supabase/client');
  const supabase = createClient();
  const next = `${window.location.pathname}${window.location.search}`;
  document.cookie = `auth_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      scopes: 'read:user user:email',
    },
  });
  if (error) throw error;
  if (data.url) {
    window.location.assign(data.url);
    // Give the navigation a tick so we never fall through to a thrown error.
    await new Promise(() => {});
  }
  throw new Error('GitHub did not return a sign-in URL.');
}

async function fetchInstallationIdsFromGitHub(): Promise<number[]> {
  const ghToken = readGhToken();
  if (!ghToken) {
    return reauthorizeGitHub();
  }

  const response = await fetch('https://api.github.com/user/installations?per_page=100', {
    headers: {
      Authorization: `Bearer ${ghToken}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  // 401/403 means the OAuth token expired or was revoked — refresh it the same way.
  if (response.status === 401 || response.status === 403) {
    return reauthorizeGitHub();
  }

  if (!response.ok) {
    throw new Error(
      await readError(
        response,
        'Could not list GitHub App installations. Sign in again, then retry Sync.'
      )
    );
  }

  const payload = (await response.json()) as {
    installations?: Array<{ id?: number; app_slug?: string }>;
  };
  const appSlug = (process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || '').toLowerCase();
  const ids = [
    ...new Set(
      (payload.installations ?? [])
        .filter((installation) => {
          if (!appSlug) return true;
          const slug = installation.app_slug?.toLowerCase();
          return !slug || slug === appSlug;
        })
        .map((installation) => Number(installation.id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];

  if (ids.length === 0) {
    throw new Error(
      'No GitHub App installation found for this account. Click Add repository and install the app on your repos.'
    );
  }

  return ids;
}

async function resolveInstallationIds(knownIds: number[]): Promise<number[]> {
  if (knownIds.length > 0) return knownIds;
  return fetchInstallationIdsFromGitHub();
}

async function syncRepositories(token: string, installationIds: number[]) {
  const ids = await resolveInstallationIds(installationIds);

  for (const installationId of ids) {
    const response = await fetch(backendUrl('/api/v1/repos/sync-installation'), {
      method: 'POST',
      headers: authHeaders(token),
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
