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
    kind: 'released',
    title: 'Payout released',
    body: '220 USDC sent to @gaearon',
    isRead: false,
    refId: null,
    data: { repoId: 'repo_9' },
    createdAt: '2026-10-01T12:00:00.000Z',
  },
];

function mockFetch() {
  return vi.fn((url: string) => {
    if (url.includes('/notifications/unread-count')) {
      return Promise.resolve({ ok: true, json: async () => ({ count: 1 }) });
    }
    if (url.endsWith('/notifications')) {
      return Promise.resolve({ ok: true, json: async () => NOTICES });
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

  it('loads notifications when opened and can mark all read', async () => {
    const fetchMock = mockFetch();
    vi.stubGlobal('fetch', fetchMock);
    render(<NotificationBell token="tok" />);

    fireEvent.click(await screen.findByRole('button', { name: /Notifications/ }));

    expect(await screen.findByText('Payout released')).toBeInTheDocument();
    expect(screen.getByText('220 USDC sent to @gaearon')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:5000/api/v1/notifications/read-all',
        expect.objectContaining({ method: 'POST' })
      )
    );
    expect(screen.getByText('You are caught up')).toBeInTheDocument();
  });
});
