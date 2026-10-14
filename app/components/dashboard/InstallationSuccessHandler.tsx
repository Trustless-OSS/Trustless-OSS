'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { handleError, notifySuccess } from '@/lib/notifications';
import { backendUrl, remoteBackendUrl } from '@/lib/backend';
import { isPersistentDependencyFailure, waitForBackendReady } from '@/lib/health';
import {
  GITHUB_INSTALL_FAILED,
  GITHUB_INSTALL_SUCCESS,
  notifyGitHubInstallParent,
} from '@/lib/github-install';
import { REPO_PAGE_SIZE } from '@/app/components/dashboard/ReposPagination';

const MAX_SYNC_ATTEMPTS = 3;
const RETRY_DELAY_MS = 800;
const COLD_START_RETRY_DELAY_MS = 2000;

type InstallationRepo = {
  githubRepoId: number;
  fullName: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

function looksLikeHtml(details: string) {
  const trimmed = details.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

function formatSyncError(status: number, details: string): string {
  if (details.includes('Redis unavailable')) {
    return `${remoteBackendUrl()} is up, but Redis is unavailable. Installation sync cannot finish until Redis is restored.`;
  }

  if (isTransientStatus(status) || looksLikeHtml(details)) {
    return `${remoteBackendUrl()} is waking up or temporarily unavailable (${status}). Wait a few seconds and install again.`;
  }

  if (details.includes('JSON web token could not be decoded')) {
    return `GitHub rejected the App JWT from ${remoteBackendUrl()}. On that API, GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must belong to the same GitHub App as NEXT_PUBLIC_GITHUB_APP_SLUG, and the PEM must keep its newlines.`;
  }

  if (details.includes('/app/installations/') && details.includes('404')) {
    return 'The API could not create a token for this GitHub App installation. The backend App ID and private key must belong to the same GitHub App as NEXT_PUBLIC_GITHUB_APP_SLUG.';
  }

  const summary = details.replace(/\s+/g, ' ').slice(0, 180);
  return `Installation sync failed (${status}): ${summary}`;
}

function formatNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Installation sync failed.';
  if (
    message === 'Failed to fetch' ||
    message === 'Load failed' ||
    message.includes('NetworkError')
  ) {
    return `Could not reach ${remoteBackendUrl()} from this browser tab. Open the app at http://localhost:3000 and add that origin to CORS_ALLOWED_ORIGINS on the API.`;
  }
  return message;
}

function clearInstallationQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete('installation_id');
  url.searchParams.delete('setup_action');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

function parseInstallationRepos(payload: unknown): InstallationRepo[] {
  if (!payload || typeof payload !== 'object') return [];
  const repositories = (payload as { repositories?: unknown }).repositories;
  if (!Array.isArray(repositories)) return [];

  return repositories.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const row = entry as Record<string, unknown>;
    const githubRepoId = Number(row.githubRepoId ?? row.github_repo_id);
    const fullName = typeof row.fullName === 'string' ? row.fullName : row.full_name;
    if (!Number.isInteger(githubRepoId) || githubRepoId <= 0 || typeof fullName !== 'string') {
      return [];
    }
    return [{ githubRepoId, fullName }];
  });
}

async function authorizedFetch(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(backendUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

async function fetchWithRetry(
  path: string,
  accessToken: string,
  init?: RequestInit
): Promise<Response> {
  let lastError = 'Installation sync failed.';

  for (let attempt = 1; attempt <= MAX_SYNC_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await authorizedFetch(path, accessToken, init);
    } catch (error: unknown) {
      throw new Error(formatNetworkError(error), { cause: error });
    }

    if (response.ok) {
      return response;
    }

    lastError = formatSyncError(response.status, await response.text());
    const retryDelay = isTransientStatus(response.status)
      ? COLD_START_RETRY_DELAY_MS
      : RETRY_DELAY_MS;
    if (
      attempt < MAX_SYNC_ATTEMPTS &&
      (isTransientStatus(response.status) || response.status >= 500)
    ) {
      await sleep(retryDelay);
      continue;
    }
    break;
  }

  throw new Error(lastError);
}

export default function InstallationSuccessHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get('installation_id');

    if (!installationId) return;

    const numericInstallationId = Number(installationId);
    if (!Number.isInteger(numericInstallationId) || numericInstallationId <= 0) {
      const message = 'GitHub did not return a valid installation id.';
      handleError(message, 'Connect repository');
      notifyGitHubInstallParent({ type: GITHUB_INSTALL_FAILED, message });
      clearInstallationQuery();
      return;
    }

    const onReposPage = pathname === '/dashboard/repos' || pathname.startsWith('/dashboard/repos/');
    if (!onReposPage) {
      const next = new URLSearchParams(params);
      router.replace(`/dashboard/repos?${next.toString()}`);
      return;
    }

    let cancelled = false;

    const syncInstallation = async () => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('Sign in again, then retry connecting the repository.');
      }

      const health = await waitForBackendReady(15_000);
      if (health.status !== 'ok') {
        if (isPersistentDependencyFailure(health)) {
          throw new Error(
            `${health.message} Installation sync cannot finish until that dependency is restored.`
          );
        }
        throw new Error(
          `${remoteBackendUrl()} is waking up or temporarily unavailable. Wait a few seconds and install again.`
        );
      }

      const listResponse = await fetchWithRetry(
        `/api/v1/repos/installation-repos?installationId=${numericInstallationId}`,
        session.access_token
      );
      const repositories = parseInstallationRepos(await listResponse.json());

      if (cancelled) return;

      if (repositories.length === 0) {
        notifySuccess('GitHub App connected', 'No public repositories were selected.');
        notifyGitHubInstallParent(GITHUB_INSTALL_SUCCESS);
        clearInstallationQuery();
        router.refresh();
        return;
      }

      for (let offset = 0; offset < repositories.length; offset += REPO_PAGE_SIZE) {
        if (cancelled) return;

        const batch = repositories.slice(offset, offset + REPO_PAGE_SIZE);
        await fetchWithRetry('/api/v1/repos/sync-installation', session.access_token, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            installationId: numericInstallationId,
            githubRepoIds: batch.map((repo) => repo.githubRepoId),
          }),
        });

        if (cancelled) return;
        router.refresh();
      }

      if (cancelled) return;

      notifySuccess(
        'Repositories connected',
        `Synced ${repositories.length} repositor${repositories.length === 1 ? 'y' : 'ies'} from GitHub.`
      );
      notifyGitHubInstallParent(GITHUB_INSTALL_SUCCESS);
      clearInstallationQuery();
      router.refresh();
    };

    void syncInstallation().catch((error: unknown) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : 'Installation sync failed.';
      handleError(message, 'Connect repository');
      notifyGitHubInstallParent({ type: GITHUB_INSTALL_FAILED, message });
      clearInstallationQuery();
      router.refresh();
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
