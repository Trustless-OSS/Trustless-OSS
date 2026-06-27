import { describe, it, expect, vi, beforeEach } from 'vitest';
import appHandler from '../../handler/app_handler.js';
import { beginShutdown, resetLifecycleState } from '../../lib/lifecycle.js';

vi.mock('../../router', () => ({
  dispatch: vi.fn().mockResolvedValue(undefined),
  json: vi.fn((res, data, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  }),
}));

vi.mock('../../app', () => ({}));

describe('appHandler shutdown behavior', () => {
  beforeEach(() => {
    resetLifecycleState();
  });

  it('returns 503 when server is shutting down', async () => {
    beginShutdown();

    const req = { method: 'GET', url: '/api/health' } as any;
    const res = {
      statusCode: 200,
      headersSent: false,
      once: vi.fn(),
      setHeader: vi.fn(),
      end: vi.fn(),
    } as any;

    await appHandler(req, res);

    expect(res.statusCode).toBe(503);
    expect(res.end).toHaveBeenCalled();
  });
});
