import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { readBody, json } from '../router.js';
import {
  handleIssueLabeled,
  handleIssueAssigned,
  handleIssueUnassigned,
  handlePRMerged,
} from '../lib/github/webhook.js';

export async function githubWebhookHandler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const rawBody = await readBody(req);
  const bodyStr = rawBody.toString('utf-8');

  // Verify HMAC signature
  const sig = (req.headers['x-hub-signature-256'] as string) ?? '';
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET!).update(rawBody).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    json(res, { error: 'Unauthorized — invalid webhook signature' }, 401);
    return;
  }

  const event = (req.headers['x-github-event'] as string) ?? '';
  const payload = JSON.parse(bodyStr) as Record<string, unknown>;
  const action = payload.action as string | undefined;

  console.log(`[Webhook] ${event}.${action ?? ''}`);

  try {
    if (event === 'issues') {
      if (action === 'labeled') await handleIssueLabeled(payload);
      else if (action === 'assigned') await handleIssueAssigned(payload);
      else if (action === 'unassigned') await handleIssueUnassigned(payload);
    }

    if (event === 'pull_request' && action === 'closed') {
      const pr = payload.pull_request as { merged: boolean } | undefined;
      if (pr?.merged) {
        await handlePRMerged(payload);
      }
    }

    json(res, { ok: true });
  } catch (err) {
    console.error('[Webhook] Handler error:', err);
    json(res, { error: 'Internal server error' }, 500);
  }
}
