import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SyncReposButton from '../SyncReposButton';

const refresh = vi.fn();
const handleError = vi.fn();
const notifySuccess = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('@/lib/notifications', () => ({
  handleError: (...args: unknown[]) => handleError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

afterEach(() => {
  cleanup();
  refresh.mockReset();
  handleError.mockReset();
  notifySuccess.mockReset();
  vi.unstubAllGlobals();
  document.cookie = 'gh_token=; Max-Age=0; path=/';
});

describe('SyncReposButton', () => {
  it('renders an icon-only sync control', () => {
    render(<SyncReposButton token="token" installationIds={[42]} />);

    const button = screen.getByRole('button', { name: 'Sync' });
    expect(button).toHaveAttribute('aria-label', 'Sync');
    expect(button).not.toHaveTextContent('Syncing');
  });

  it('syncs repositories and refreshes the page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    render(<SyncReposButton token="token" installationIds={[42]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/backend/api/v1/repos/sync-installation',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ installationId: 42 }),
        })
      );
      expect(notifySuccess).toHaveBeenCalledWith(
        'Repositories synced',
        'GitHub repositories are up to date.'
      );
      expect(refresh).toHaveBeenCalled();
    });
    expect(fetchMock).not.toHaveBeenCalledWith(
      '/api/backend/api/v1/repos/sync',
      expect.anything()
    );
  });

  it('fetches GitHub installations when none are known yet', async () => {
    document.cookie = 'gh_token=github-token; path=/';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          installations: [{ id: 99, app_slug: 'Trustless-OSS-Dev' }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    render(<SyncReposButton token="token" installationIds={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.github.com/user/installations?per_page=100',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer github-token',
          }),
        })
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/backend/api/v1/repos/sync-installation',
        expect.objectContaining({
          body: JSON.stringify({ installationId: 99 }),
        })
      );
      expect(notifySuccess).toHaveBeenCalled();
      expect(refresh).toHaveBeenCalled();
    });
  });

  it('does not refresh when GitHub installations cannot be resolved', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<SyncReposButton token="token" installationIds={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(handleError).toHaveBeenCalled();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not refresh when sync fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => JSON.stringify({ error: 'Redis unavailable' }),
      })
    );

    render(<SyncReposButton token="token" installationIds={[7]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sync' }));

    await waitFor(() => {
      expect(handleError).toHaveBeenCalled();
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
