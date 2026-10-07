import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from '../Navbar';
import type { User } from '@supabase/supabase-js';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const setTheme = vi.hoisted(() => vi.fn());

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme,
  }),
}));

// AccountBar reads the Supabase session; NotificationBell polls the backend
// unread count. Mock both so the bell renders "3 unread" deterministically.
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }),
    },
  }),
}));

vi.mock('@/lib/backend', () => ({
  backendUrl: (p: string) => `/api/backend/api/v1${p}`,
  authHeaders: () => ({ Authorization: 'Bearer tok' }),
}));

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url.includes('/notifications/unread-count')) {
        return Promise.resolve({ ok: true, json: async () => ({ count: 3 }) });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    })
  );
});

afterEach(() => {
  cleanup();
  setTheme.mockClear();
  vi.unstubAllGlobals();
});

const user = {
  id: 'user_1',
  email: 'ryzen@example.com',
  user_metadata: { user_name: 'ryzen-xp', avatar_url: '' },
} as unknown as User;

describe('Navbar', () => {
  it('keeps the bar free of page routes for guests', () => {
    render(<Navbar />);

    expect(screen.getByRole('link', { name: 'Trustless OSS' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Docs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Repositories' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();
  });

  it('opens a profile menu with Profile, Dashboard, and Sign out', async () => {
    render(<Navbar user={user} />);

    expect(screen.queryByRole('link', { name: 'Docs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Repositories' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dashboard' })).not.toBeInTheDocument();

    expect(screen.getByTestId('account-bar')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: 'Notifications, 3 unread' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open profile' })).not.toBeInTheDocument();
    const settings = screen.getByRole('button', { name: /open settings for ryzen-xp/i });
    const labels = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter(Boolean);
    expect(labels).toEqual([
      'Open settings for ryzen-xp',
      'Notifications, 3 unread',
      'Switch to dark mode',
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }));
    expect(setTheme).toHaveBeenCalledWith('dark');

    fireEvent.pointerDown(settings);
    fireEvent.click(settings);

    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/profile');
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/dashboard'
    );
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitemcheckbox', { name: /dark mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Repositories' })).not.toBeInTheDocument();
  });
});
