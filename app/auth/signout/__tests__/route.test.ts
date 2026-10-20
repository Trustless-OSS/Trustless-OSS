import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, signOutMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: createClientMock,
}));

import { POST } from '../route';

describe('sign-out route', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('signs out, clears auxiliary auth cookies, and redirects with GET to the same origin', async () => {
    signOutMock.mockResolvedValue({ error: null });
    createClientMock.mockResolvedValue({ auth: { signOut: signOutMock } });

    const response = await POST(
      new Request('https://trustless.example/auth/signout', { method: 'POST' })
    );

    expect(signOutMock).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('https://trustless.example/');
    expect(response.headers.get('set-cookie')).toMatch(/gh_token=;.*max-age=0/i);
    expect(response.headers.get('set-cookie')).toMatch(/auth_next=;.*max-age=0/i);
  });

  it('returns an error instead of redirecting when Supabase sign-out fails', async () => {
    signOutMock.mockResolvedValue({ error: new Error('network failure') });
    createClientMock.mockResolvedValue({ auth: { signOut: signOutMock } });

    const response = await POST(
      new Request('https://trustless.example/auth/signout', { method: 'POST' })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Unable to sign out. Please try again.',
    });
    expect(response.headers.get('location')).toBeNull();
  });
});
