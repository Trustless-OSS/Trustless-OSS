import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ConnectRepoPage from '../page';

const push = vi.fn();
const back = vi.fn();
const open = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    back,
  }),
}));

vi.mock('@/lib/notifications', () => ({
  handleError: vi.fn(),
  notifySuccess: vi.fn(),
}));

afterEach(() => {
  cleanup();
  push.mockClear();
  back.mockClear();
  open.mockClear();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.stubGlobal('open', open);
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    })
  );
});

describe('ConnectRepoPage', () => {
  it('renders a clear install card without terminal-style copy', () => {
    render(<ConnectRepoPage />);

    expect(screen.getByText('Connect repository')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Install the GitHub App' })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Connect a repository by installing the Trustless OSS GitHub App and choosing which repos to grant access/
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Install GitHub App/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();

    expect(screen.queryByText(/sudo/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/apt-get install/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AWAITING_GITHUB_CALLBACK/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/EXECUTE_INSTALLATION/i)).not.toBeInTheDocument();
  });

  it('continues GitHub App install in the same tab', () => {
    render(<ConnectRepoPage />);

    fireEvent.click(screen.getByRole('button', { name: /Install GitHub App/i }));

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(
      'https://github.com/apps/Trustless-OSS/installations/new',
      '_self'
    );
  });

  it('keeps the back action available', () => {
    render(<ConnectRepoPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    expect(back).toHaveBeenCalledOnce();
  });
});
