import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RewardSettingsForm from '../RewardSettingsForm';
import { notifySuccess } from '@/lib/notifications';

vi.mock('@/lib/notifications', () => ({
  notifySuccess: vi.fn(),
  handleError: vi.fn(),
}));

// backendUrl returns the API path directly in tests
vi.mock('@/lib/backend', () => ({
  backendUrl: (p: string) => {
    const raw = p.startsWith('/') ? p : `/${p}`;
    if (raw.startsWith('/api/v1')) return raw;
    if (raw.startsWith('/api/')) return raw.replace(/^\/api\//, '/api/v1/');
    if (raw.startsWith('/api')) return '/api/v1';
    return `/api/v1${raw}`;
  },
  authHeaders: (token: string) => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }),
}));

const defaultProps = {
  repoId: 'repo_123',
  token: 'session_token',
  initialLevels: [
    { label: 'low', amount: 0.1 },
    { label: 'medium', amount: 2 },
    { label: 'high', amount: 3 },
  ],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('RewardSettingsForm', () => {
  it('renders each tier read-only with the top-level actions', () => {
    render(<RewardSettingsForm {...defaultProps} />);

    expect(screen.getByText('Reward parameters')).toBeInTheDocument();
    expect(screen.getByText('low')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add level' })).toBeInTheDocument();
  });

  it('turns every tier into an editable input in edit mode', () => {
    render(<RewardSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(screen.getByLabelText('low reward in USDC')).toBeInTheDocument();
    expect(screen.getByLabelText('medium reward in USDC')).toBeInTheDocument();
    expect(screen.getByLabelText('high reward in USDC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('saves only the tiers that changed', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' });
    vi.stubGlobal('fetch', fetchMock);

    render(<RewardSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('high reward in USDC'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/repos/repo_123/rewards',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ Authorization: 'Bearer session_token' }),
      })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ label: 'high', amount: 8 });
    expect(notifySuccess).toHaveBeenCalled();
  });

  it('selects a tier for deletion and confirms removal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '{}' });
    vi.stubGlobal('fetch', fetchMock);

    render(<RewardSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByLabelText('Select medium for removal'));

    // "Remove (1)" button becomes enabled; clicking opens the confirm dialog
    fireEvent.click(screen.getByRole('button', { name: /Remove \(1\)/ }));
    const dialog = await screen.findByRole('alertdialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/repos/repo_123/rewards/medium');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
    expect(notifySuccess).toHaveBeenCalled();
  });
});
