import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RewardSettingsForm from '../RewardSettingsForm';
import { handleError, notifySuccess } from '@/lib/notifications';

vi.mock('@/lib/notifications', () => ({
  notifySuccess: vi.fn(),
  handleError: vi.fn(),
}));

const defaultProps = {
  repoId: 'repo_123',
  token: 'session_token',
  initialLow: 0.1,
  initialMedium: 2,
  initialHigh: 3,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('RewardSettingsForm', () => {
  it('renders a separate edit control on each reward tier', () => {
    render(<RewardSettingsForm {...defaultProps} />);

    expect(screen.getByText('Reward parameters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Low reward' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Medium reward' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit High reward' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument();
  });

  it('edits one tier and asks for confirmation after leaving the input', () => {
    render(<RewardSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Low reward' }));
    const input = screen.getByLabelText('Low reward in USDC');
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.blur(input);

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText(/Update low reward/i)).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(dialog.textContent).toMatch(/0\.1/);
    expect(dialog.textContent).toMatch(/9/);
  });

  it('skips the confirm dialog when the value is unchanged', () => {
    render(<RewardSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Medium reward' }));
    fireEvent.blur(screen.getByLabelText('Medium reward in USDC'));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('cancels a pending change and restores the saved value', () => {
    render(<RewardSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Low reward' }));
    fireEvent.change(screen.getByLabelText('Low reward in USDC'), { target: { value: '9' } });
    fireEvent.blur(screen.getByLabelText('Low reward in USDC'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('0.1')).toBeInTheDocument();
    expect(screen.queryByText('9')).not.toBeInTheDocument();
  });

  it('saves the confirmed tier update', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RewardSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit High reward' }));
    fireEvent.change(screen.getByLabelText('High reward in USDC'), { target: { value: '8' } });
    fireEvent.blur(screen.getByLabelText('High reward in USDC'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/backend/api/v1/repos/repo_123/rewards',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: 'Bearer session_token',
          }),
        })
      );
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      reward_low: 0.1,
      reward_medium: 2,
      reward_high: 8,
    });
    expect(notifySuccess).toHaveBeenCalled();
    expect(await screen.findByText('8')).toBeInTheDocument();
  });

  it('keeps the confirm dialog open when save fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Reward update blocked' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<RewardSettingsForm {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit Low reward' }));
    fireEvent.change(screen.getByLabelText('Low reward in USDC'), { target: { value: '4' } });
    fireEvent.blur(screen.getByLabelText('Low reward in USDC'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(handleError).toHaveBeenCalled();
    });

    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(notifySuccess).not.toHaveBeenCalled();
  });
});
