import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DeleteRepoButton from '../DeleteRepoButton';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
  }),
}));

vi.mock('@/lib/notifications', () => ({
  handleError: vi.fn(),
  notifySuccess: vi.fn(),
}));

afterEach(() => {
  cleanup();
  push.mockClear();
  vi.unstubAllGlobals();
});

describe('DeleteRepoButton', () => {
  it('opens a product-styled confirmation dialog', () => {
    render(<DeleteRepoButton repoId="repo-1" token="token" />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.getByRole('dialog', { name: 'Delete this repository?' })).toBeInTheDocument();
    expect(screen.getByText('Remove repository')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete repository' })).toBeInTheDocument();
    expect(screen.queryByText(/CONFIRM_DELETE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ACTION \/\/ PERMANENT_DELETE/i)).not.toBeInTheDocument();
  });

  it('closes the dialog from cancel without calling the API', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<DeleteRepoButton repoId="repo-1" token="token" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes the repository after confirmation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      })
    );

    render(<DeleteRepoButton repoId="repo-1" token="token" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete repository' }));

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith('/dashboard/repos');
    });
  });
});
