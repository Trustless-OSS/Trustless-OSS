import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { readBody, json } from '../router.js';
import { webhooksQueue } from '../lib/queue.js';

import { logger } from '../lib/logger.js';

const log = logger.child({ module: 'webhook-route' });

const webhookHistory: boolean[] = [];
const MAX_HISTORY_LEN = 100;

export async function githubWebhookHandler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const rawBody = await readBody(req);
  const bodyStr = rawBody.toString('utf-8');

  const event = (req.headers['x-github-event'] as string) ?? '';
  const sig = (req.headers['x-hub-signature-256'] as string) ?? '';

  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    log.error('GITHUB_WEBHOOK_SECRET is not set in environment variables');
    json(res, { error: 'Internal server error — missing secret' }, 500);
    return;
  }

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  let authorized = false;
  try {
    if (sig.length === expected.length) {
      authorized = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    }
  } catch (err) {
    log.error({ err }, 'signature comparison error');
  }

  if (!authorized) {
    log.warn({ event }, 'unauthorized webhook signature');
    json(res, { error: 'Unauthorized — invalid webhook signature' }, 401);
    return;
  }

  const payload = JSON.parse(bodyStr) as Record<string, unknown>;
  const action = payload.action as string | undefined;
  const repository = payload.repository as { id: number; full_name: string } | undefined;

  log.info(
    { event, action: action ?? '', repo: repository?.full_name, repoId: repository?.id },
    'authorized webhook received'
  );

  try {
    const deliveryId = req.headers['x-github-delivery'] as string | undefined;

    let isDuplicate = false;
    if (deliveryId) {
      const existingJob = await webhooksQueue.getJob(deliveryId);
      if (existingJob) {
        isDuplicate = true;
      }
    }

    webhookHistory.push(isDuplicate);
    if (webhookHistory.length > MAX_HISTORY_LEN) {
      webhookHistory.shift();
    }

    const duplicateCount = webhookHistory.filter(Boolean).length;
    const duplicateRate = duplicateCount / webhookHistory.length;

    log.info(
      {
        deliveryId,
        isDuplicate,
        duplicateRate: `${(duplicateRate * 100).toFixed(1)}%`,
        windowSize: webhookHistory.length,
      },
      'webhook delivery check'
    );

    if (webhookHistory.length >= 10 && duplicateRate > 0.3) {
      log.warn(
        { duplicateRate: `${(duplicateRate * 100).toFixed(1)}%` },
        'High webhook duplication rate detected (>30%)'
      );
    }

    if (isDuplicate) {
      json(res, { ok: true, duplicate: true });
      return;
    }

    // Queue the webhook event instead of processing inline
    await webhooksQueue.add('github-webhook', { event, action, payload }, { jobId: deliveryId });

    json(res, { ok: true });
  } catch (err) {
    console.error('[Webhook] Queue error:', err);
    log.error({ err, event, action }, 'webhook handler error');
    json(res, { error: 'Internal server error' }, 500);
  }
}
