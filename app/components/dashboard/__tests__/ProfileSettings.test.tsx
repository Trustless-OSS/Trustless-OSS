import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import ProfileSettings from '../ProfileSettings';

const updateUser = vi.fn();
const handleError = vi.fn();
const notifySuccess = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser,
    },
  }),
}));

vi.mock('@/lib/notifications', () => ({
  handleError: (...args: unknown[]) => handleError(...args),
  notifySuccess: (...args: unknown[]) => notifySuccess(...args),
}));

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={alt ?? ''} {...props} />
  ),
}));

function buildUser(overrides: Partial<User['user_metadata']> = {}): User {
  return {
    id: 'user_1',
    email: 'dev@example.com',
    user_metadata: {
      user_name: 'octocat',
      avatar_url: 'https://github.com/octocat.png',
      display_name: 'Octocat',
      bio: 'Ships OSS',
      location: 'Remote',
      website: 'https://example.com',
      skills: 'TypeScript, Rust',
      stellar_address: '',
      ...overrides,
    },
  } as unknown as User;
}

describe('ProfileSettings', () => {
  afterEach(() => {
    cleanup();
    updateUser.mockReset();
    handleError.mockReset();
    notifySuccess.mockReset();
    vi.unstubAllGlobals();
  });

  it('previews the display name and completeness as the form changes', () => {
    render(<ProfileSettings user={buildUser()} />);

    expect(screen.getAllByText('Octocat').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: '@octocat on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/octocat'
    );
    expect(screen.getByText('86%')).toBeInTheDocument();
    expect(screen.queryByText('5/6')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Profile completeness')).toBeInTheDocument();
    expect(screen.getAllByText('Verified').length).toBeGreaterThan(0);
    expect(screen.getByText('Verified through GitHub sign-in.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Discard' })).not.toBeInTheDocument();
    expect(screen.queryByText('You have unsaved profile changes.')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dashboard' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: '' } });

    expect(screen.getByRole('heading', { name: 'Ada' })).toBeInTheDocument();
    expect(screen.queryByText('You have unsaved profile changes.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Discard' })).toHaveAttribute(
      'data-variant',
      'destructive'
    );
  });

  it('accepts social usernames without requiring full profile links', () => {
    render(<ProfileSettings user={buildUser()} />);

    fireEvent.change(screen.getByLabelText('Telegram'), {
      target: { value: 'https://t.me/ada_lovelace' },
    });
    fireEvent.change(screen.getByLabelText('Discord'), {
      target: { value: '@ada.dev' },
    });
    fireEvent.change(screen.getByLabelText('Twitter / X'), {
      target: { value: 'https://x.com/ada' },
    });

    expect(screen.getByLabelText('Telegram')).toHaveValue('ada_lovelace');
    expect(screen.getByLabelText('Discord')).toHaveValue('ada.dev');
    expect(screen.getByLabelText('Twitter / X')).toHaveValue('ada');
  });

  it('adds a skill chip on Enter and does not duplicate it', () => {
    render(<ProfileSettings user={buildUser()} />);

    const skills = screen.getByLabelText('Skills');
    fireEvent.change(skills, { target: { value: 'Solidity' } });
    fireEvent.keyDown(skills, { key: 'Enter' });

    expect(screen.getByText('Solidity')).toBeInTheDocument();
    expect(screen.getByText('3 listed')).toBeInTheDocument();

    fireEvent.change(skills, { target: { value: 'solidity' } });
    fireEvent.keyDown(skills, { key: 'Enter' });

    expect(screen.getAllByText('Solidity')).toHaveLength(1);
  });

  it('does not count completeness for a missing GitHub email', () => {
    render(<ProfileSettings user={{ ...buildUser(), email: undefined } as User} />);

    expect(screen.getByText('71%')).toBeInTheDocument();
    expect(screen.getByText('Not on GitHub')).toBeInTheDocument();
    expect(screen.getByText('Sign in with GitHub to attach a verified email.')).toBeInTheDocument();
  });

  it('shows the payout wallet on the profile page and copies the connected address', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    updateUser.mockResolvedValue({ error: null });

    render(
      <ProfileSettings
        user={buildUser({ stellar_address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD' })}
      />
    );

    expect(screen.getByText('Ready for payouts')).toBeInTheDocument();
    expect(screen.getByText('Payout wallet')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy address' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Connect Stellar wallet' })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('GABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCD');
      expect(notifySuccess).toHaveBeenCalledWith('Address copied');
    });
  });
});
