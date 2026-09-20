import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

describe('backend proxy route', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('retries a socket hang up and then returns the upstream body', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('socket hang up'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest('http://localhost:3000/api/backend/api/v1/health');
    const pending = GET(request, { params: Promise.resolve({ path: ['api', 'v1', 'health'] }) });
    await vi.advanceTimersByTimeAsync(2000);
    const response = await pending;

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives installation sync a longer timeout', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok', { status: 200 })));

    const request = new NextRequest(
      'http://localhost:3000/api/backend/api/v1/repos/sync-installation',
      {
        method: 'POST',
        body: JSON.stringify({ installationId: 1 }),
      }
    );
    await POST(request, {
      params: Promise.resolve({ path: ['api', 'v1', 'repos', 'sync-installation'] }),
    });

    expect(timeout).toHaveBeenCalledWith(170_000);
  });

  it('does not retry a timed-out repository sync', async () => {
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    const fetchMock = vi.fn().mockRejectedValue(timeout);
    vi.stubGlobal('fetch', fetchMock);

    const request = new NextRequest(
      'http://localhost:3000/api/backend/api/v1/repos/sync-installation',
      {
        method: 'POST',
        body: JSON.stringify({ installationId: 1 }),
      }
    );
    const response = await POST(request, {
      params: Promise.resolve({ path: ['api', 'v1', 'repos', 'sync-installation'] }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(504);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('did not respond in time'),
    });
  });
});
