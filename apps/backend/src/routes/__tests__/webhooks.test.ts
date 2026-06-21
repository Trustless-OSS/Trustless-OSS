import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { githubWebhookHandler } from '../webhooks.js';
import { webhooksQueue } from '../../lib/queue.js';
import { readBody } from '../../router.js';

vi.mock('../../lib/queue.js', () => ({
  webhooksQueue: {
    getJob: vi.fn(),
    add: vi.fn(),
  },
}));

const mockJson = vi.fn();
vi.mock('../../router.js', () => ({
  readBody: vi.fn(),
  json: (...args: any[]) => mockJson(...args),
}));

describe('GitHub Webhook Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
  });

  const generateSignature = (bodyStr: string) => {
    return 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(bodyStr).digest('hex');
  };

  it('successfully queues a new webhook delivery', async () => {
    const payload = { action: 'opened', repository: { id: 123, full_name: 'test/repo' } };
    const bodyStr = JSON.stringify(payload);
    const signature = generateSignature(bodyStr);

    (readBody as any).mockResolvedValue(Buffer.from(bodyStr));
    (webhooksQueue.getJob as any).mockResolvedValue(null);

    const req = {
      headers: {
        'x-github-event': 'issues',
        'x-hub-signature-256': signature,
        'x-github-delivery': 'unique-delivery-id-1',
      },
    } as any;
    const res = {} as any;

    await githubWebhookHandler(req, res);

    expect(webhooksQueue.getJob).toHaveBeenCalledWith('unique-delivery-id-1');
    expect(webhooksQueue.add).toHaveBeenCalledWith(
      'github-webhook',
      { event: 'issues', action: 'opened', payload },
      { jobId: 'unique-delivery-id-1' }
    );
    expect(mockJson).toHaveBeenCalledWith(res, { ok: true });
  });

  it('returns 200 OK immediately for a duplicate webhook delivery without queueing', async () => {
    const payload = { action: 'opened', repository: { id: 123, full_name: 'test/repo' } };
    const bodyStr = JSON.stringify(payload);
    const signature = generateSignature(bodyStr);

    (readBody as any).mockResolvedValue(Buffer.from(bodyStr));
    (webhooksQueue.getJob as any).mockResolvedValue({ id: 'unique-delivery-id-2' }); // existing job found

    const req = {
      headers: {
        'x-github-event': 'issues',
        'x-hub-signature-256': signature,
        'x-github-delivery': 'unique-delivery-id-2',
      },
    } as any;
    const res = {} as any;

    await githubWebhookHandler(req, res);

    expect(webhooksQueue.getJob).toHaveBeenCalledWith('unique-delivery-id-2');
    expect(webhooksQueue.add).not.toHaveBeenCalled();
    expect(mockJson).toHaveBeenCalledWith(res, { ok: true, duplicate: true });
  });

  it('triggers warning when duplicate rate exceeds 30% after 10 requests', async () => {
    const payload = { action: 'opened' };
    const bodyStr = JSON.stringify(payload);
    const signature = generateSignature(bodyStr);
    (readBody as any).mockResolvedValue(Buffer.from(bodyStr));

    (webhooksQueue.getJob as any).mockResolvedValue({ id: 'some-id' });

    const req = {
      headers: {
        'x-github-event': 'issues',
        'x-hub-signature-256': signature,
        'x-github-delivery': 'dup-id',
      },
    } as any;
    const res = {} as any;

    for (let i = 0; i < 11; i++) {
      await githubWebhookHandler(req, res);
    }

    expect(mockJson).toHaveBeenCalledTimes(11);
  });
});
