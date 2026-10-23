import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NotificationBell from '../NotificationBell';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/backend', () => ({
  backendUrl: (p: string) => {
    const raw = p.startsWith('/') ? p : `/${p}`;
    if (raw.startsWith('/api/v1')) return `http://localhost:5000${raw}`;
    if (raw.startsWith('/api/'))
      return `http://localhost:5000${raw.replace(/^\/api\//, '/api/v1/')}`;
    if (raw.startsWith('/api')) return 'http://localhost:5000/api/v1';
    return `http://localhost:5000/api/v1${raw}`;
  },
  authHeaders: (token: string) => ({ Authorization: `Bearer ${token}` }),
}));

const NOTICES = [
  {
    id: 'n1',
    event_type: 'PULL_REQUEST_MERGED',
    title: 'Payout released',
    body: '220 USDC sent to @gaearon',
    read: false,
    refId: null,
    data: { repoId: 'repo_9' },
    at: '2026-10-01T12:00:00.000Z',
  },
];

function mockFetch(notices: Array<{ id: string; [key: string]: unknown }> = NOTICES) {
  return vi.fn((url: string) => {
    if (url.includes('/notifications/unread-count')) {
      return Promise.resolve({ ok: true, json: async () => ({ count: 1 }) });
    }
    if (url.endsWith('/notifications')) {
      return Promise.resolve({ ok: true, json: async () => notices });
    }
    // read-all / read-one
    return Promise.resolve({ ok: true, json: async () => ({}) });
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('NotificationBell', () => {
  it('shows the unread badge from the backend count', async () => {
    vi.stubGlobal('fetch', mockFetch());
    render(<NotificationBell token="tok" />);

    expect(
      await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    ).toBeInTheDocument();
  });

  it('uses event-specific icons and loads backend-shaped notifications', async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal('fetch', fetchMock);
    render(<NotificationBell token="tok" />);

    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(await screen.findByText('Payout released')).toBeInTheDocument();
    expect(screen.getByText('220 USDC sent to @gaearon')).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-git-merge')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/v1/notifications/read-all',
        expect.objectContaining({ method: 'POST' })
      )
    );
    // Unread badge clears once everything is marked read.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /unread/ })).not.toBeInTheDocument()
    );
  });

  it('shows specific icons for assigned, unassigned, and insufficient-funds notifications', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch([
        { id: 'n2', kind: 'bounty_assigned', title: 'Assigned', body: '', read: false },
        { id: 'n3', kind: 'bounty_unassigned', title: 'Unassigned', body: '', read: false },
        {
          id: 'n4',
          kind: 'insufficient_funds',
          title: 'Insufficient funds',
          body: '',
          read: false,
        },
      ])
    );
    render(<NotificationBell token="tok" />);

    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(await screen.findByText('Insufficient funds')).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-user-plus')).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-user-minus')).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-circle-alert')).toBeInTheDocument();
  });

  it('normalizes backend workflow notification kinds without warnings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      mockFetch([
        { id: 'n5', kind: 'amount_missing', title: 'Amount missing', body: '', read: false },
        { id: 'n6', kind: 'amount_updated', title: 'Amount updated', body: '', read: false },
        { id: 'n7', kind: 'bounty_locked', title: 'Bounty locked', body: '', read: false },
        { id: 'n8', kind: 'bounty_cancelled', title: 'Bounty cancelled', body: '', read: false },
        { id: 'n9', kind: 'wallet_required', title: 'Wallet required', body: '', read: false },
      ])
    );
    render(<NotificationBell token="tok" />);

    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(await screen.findByText('Wallet required')).toBeInTheDocument();
    expect(document.querySelectorAll('svg.lucide-circle-alert')).toHaveLength(2);
    expect(document.querySelector('svg.lucide-dollar-sign')).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-lock')).toBeInTheDocument();
    expect(document.querySelector('svg.lucide-circle-x')).toBeInTheDocument();
    expect(warn).not.toHaveBeenCalled();
  });
});
