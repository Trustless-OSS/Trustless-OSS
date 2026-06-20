import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listReposHandler, listIssuesHandler, queueStatsHandler } from '../api.js';
import { supabase } from '../../lib/supabase.js';
import { webhooksQueue, escrowOperationsQueue, syncQueue } from '../../lib/queue.js';

vi.mock('../../lib/queue.js', () => ({
  webhooksQueue: {
    getJobCounts: vi.fn(),
  },
  escrowOperationsQueue: {
    getJobCounts: vi.fn(),
  },
  syncQueue: {
    getJobCounts: vi.fn(),
  },
}));

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

const mockJson = vi.fn();
vi.mock('../../router.js', () => ({
  readBody: vi.fn(),
  json: (...args: any[]) => mockJson(...args),
}));

// mock getToken inside api.ts by just passing headers
describe('Pagination Endpoints', () => {
  let mockChain: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChain = {
      select: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValue({ data: [], count: 100, error: null }),
    };
    (supabase.from as any).mockReturnValue(mockChain);
    (supabase.auth.getUser as any).mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: { provider_id: '123' } } },
    });
  });

  it('listReposHandler uses default limit 100 and offset 0', async () => {
    const req = { url: '/api/repos', headers: { authorization: 'Bearer token' } } as any;
    const res = {} as any;

    await listReposHandler(req, res);

    expect(mockChain.range).toHaveBeenCalledWith(0, 99);
    expect(mockJson).toHaveBeenCalledWith(res, {
      data: [],
      total_count: 100,
      limit: 100,
      offset: 0,
    });
  });

  it('listReposHandler respects custom limit and offset', async () => {
    const req = {
      url: '/api/repos?limit=50&offset=20',
      headers: { authorization: 'Bearer token' },
    } as any;
    const res = {} as any;

    await listReposHandler(req, res);

    expect(mockChain.range).toHaveBeenCalledWith(20, 69);
    expect(mockJson).toHaveBeenCalledWith(res, {
      data: [],
      total_count: 100,
      limit: 50,
      offset: 20,
    });
  });

  it('listReposHandler caps limit at 200', async () => {
    const req = { url: '/api/repos?limit=500', headers: { authorization: 'Bearer token' } } as any;
    const res = {} as any;

    await listReposHandler(req, res);

    expect(mockChain.range).toHaveBeenCalledWith(0, 199);
    expect(mockJson).toHaveBeenCalledWith(res, {
      data: [],
      total_count: 100,
      limit: 200,
      offset: 0,
    });
  });

  it('listIssuesHandler uses default limit 100 and offset 0', async () => {
    const req = {
      url: '/api/repos/repo1/issues',
      headers: { authorization: 'Bearer token' },
    } as any;
    const res = {} as any;

    await listIssuesHandler(req, res, { repoId: 'repo1' });

    expect(mockChain.range).toHaveBeenCalledWith(0, 99);
    expect(mockJson).toHaveBeenCalledWith(res, {
      data: [],
      total_count: 100,
      limit: 100,
      offset: 0,
    });
  });

  describe('Queue Stats Endpoint', () => {
    it('returns queue statistics successfully', async () => {
      const mockCounts = { waiting: 1, active: 2, completed: 3, failed: 4, delayed: 5 };
      (webhooksQueue.getJobCounts as any).mockResolvedValue(mockCounts);
      (escrowOperationsQueue.getJobCounts as any).mockResolvedValue(mockCounts);
      (syncQueue.getJobCounts as any).mockResolvedValue(mockCounts);

      const req = {} as any;
      const res = {} as any;

      await queueStatsHandler(req, res);

      expect(webhooksQueue.getJobCounts).toHaveBeenCalled();
      expect(escrowOperationsQueue.getJobCounts).toHaveBeenCalled();
      expect(syncQueue.getJobCounts).toHaveBeenCalled();

      expect(mockJson).toHaveBeenCalledWith(res, {
        webhooks: mockCounts,
        'escrow-operations': mockCounts,
        sync: mockCounts,
      });
    });
  });
});
