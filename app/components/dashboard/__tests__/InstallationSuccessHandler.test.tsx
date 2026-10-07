import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstallationSuccessHandler from '../InstallationSuccessHandler';
import { GITHUB_INSTALL_CHANNEL, GITHUB_INSTALL_SUCCESS } from '@/lib/github-install';

const getSession = vi.fn();
const handleError = vi.fn();
const notifySuccess = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const usePathname = vi.fn(() => '/dashboard/repos');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace,
    refresh,
  }),
  usePathname: () => usePathname(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession,
    },
  }),
}));

vi.mock('@/lib/notifications', () => ({
  handleError: (...args: unknown[]) => handleError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

function setLocation(path: string) {
  window.history.pushState({}, '', path);
}

afterEach(() => {
  cleanup();
  getSession.mockReset();
  handleError.mockReset();
  notifySuccess.mockReset();
  replace.mockReset();
  refresh.mockReset();
  usePathname.mockReturnValue('/dashboard/repos');
  vi.unstubAllGlobals();
  setLocation('/dashboard/repos');
});

beforeEach(() => {
  getSession.mockResolvedValue({
    data: { session: { access_token: 'token' } },
  });
});

describe('InstallationSuccessHandler', () => {
  it('does nothing when GitHub did not return an installation id', () => {
    setLocation('/dashboard/repos');
    const { container } = render(<InstallationSuccessHandler />);
    expect(container).toBeEmptyDOMElement();
  });

  it('redirects install callbacks to the repos page without a loading card', () => {
    usePathname.mockReturnValue('/dashboard');
    setLocation('/dashboard?installation_id=153860735&setup_action=install');

    const { container } = render(<InstallationSuccessHandler />);

    expect(container).toBeEmptyDOMElement();
    expect(replace).toHaveBeenCalledWith(
      '/dashboard/repos?installation_id=153860735&setup_action=install'
    );
  });

  it('syncs selected repos in page-sized batches in the background', async () => {
    setLocation('/dashboard/repos?installation_id=153860735&setup_action=install');
    const received = new Promise((resolve) => {
      const listener = new BroadcastChannel(GITHUB_INSTALL_CHANNEL);
      listener.addEventListener('message', (event) => {
        listener.close();
        resolve(event.data);
      });
    });

    const repositories = Array.from({ length: 16 }, (_, index) => ({
      githubRepoId: index + 1,
      fullName: `ryzen-xp/repo-${index + 1}`,
    }));

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ repositories }),
        text: async () => '',
      })
      .mockResolvedValue({
        ok: true,
        json: async () => ({ synced: 15 }),
        text: async () => '',
      });

    const { container } = render(<InstallationSuccessHandler />);
    expect(container).toBeEmptyDOMElement();

    await expect(received).resolves.toBe(GITHUB_INSTALL_SUCCESS);
    await waitFor(() => {
      expect(notifySuccess).toHaveBeenCalledWith(
        'Repositories connected',
        'Synced 16 repositories from GitHub.'
      );
    });

    const syncCalls = vi
      .mocked(global.fetch)
      .mock.calls.filter(([url]) => String(url).includes('/api/v1/repos/sync-installation'));
    expect(syncCalls).toHaveLength(2);
    expect(JSON.parse(String(syncCalls[0][1]?.body))).toEqual({
      installationId: 153860735,
      githubRepoIds: repositories.slice(0, 15).map((repo) => repo.githubRepoId),
    });
    expect(JSON.parse(String(syncCalls[1][1]?.body))).toEqual({
      installationId: 153860735,
      githubRepoIds: [16],
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('reports errors without a blocking modal', async () => {
    setLocation('/dashboard/repos?installation_id=153860735&setup_action=install');
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
        text: async () => '',
      })
      .mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'sync exploded',
        json: async () => ({}),
      });

    const { container } = render(<InstallationSuccessHandler />);
    expect(container).toBeEmptyDOMElement();

    await waitFor(() => {
      expect(handleError).toHaveBeenCalled();
    });
  });

  it('fails fast when the API reports Redis is down', async () => {
    setLocation('/dashboard/repos?installation_id=153860735&setup_action=install');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        status: 'unhealthy',
        checks: {
          redis: { status: 'error', message: 'Redis unavailable' },
        },
      }),
      text: async () => 'Redis unavailable',
    });

    render(<InstallationSuccessHandler />);

    await waitFor(() => {
      expect(handleError).toHaveBeenCalledWith(
        expect.stringMatching(/Redis is unavailable/),
        'Connect repository'
      );
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
