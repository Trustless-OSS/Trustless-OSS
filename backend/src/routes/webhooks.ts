import crypto from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { readBody, json } from '../router.js';
import {
  handleIssueLabeled,
  handleIssueAssigned,
  handleIssueUnassigned,
  handleIssueClosed,
  handleIssueCommentCreated,
  handlePRMerged,
  handleInstallation,
  handleInstallationRepositories,
} from '../lib/github/webhook.js';

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
    console.error('[Webhook] ❌ GITHUB_WEBHOOK_SECRET is not set in environment variables');
    json(res, { error: 'Internal server error — missing secret' }, 500);
    return;
  }

  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  // Robust signature comparison
  let authorized = false;
  try {
    if (sig.length === expected.length) {
      authorized = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    }
  } catch (err) {
    console.error('[Webhook] Signature comparison error:', err);
  }

  if (!authorized) {
    console.error(`[Webhook] ❌ Unauthorized signature for event: ${event}.`);
    console.error(`Received: ${sig.slice(0, 15)}...`);
    console.error(`Expected: ${expected.slice(0, 15)}...`);
    json(res, { error: 'Unauthorized — invalid webhook signature' }, 401);
    return;
  }

  const payload = JSON.parse(bodyStr) as Record<string, unknown>;
  const action = payload.action as string | undefined;
  const repository = payload.repository as { id: number; full_name: string } | undefined;

  console.log(`[Webhook] ✅ Authorized: ${event}.${action ?? ''} for repo: ${repository?.full_name} (ID: ${repository?.id})`);

  try {
    if (event === 'issues') {
      if (action === 'opened' || action === 'labeled') await handleIssueLabeled(payload);
      else if (action === 'assigned') await handleIssueAssigned(payload);
      else if (action === 'unassigned') await handleIssueUnassigned(payload);
      else if (action === 'closed') await handleIssueClosed(payload);
    }

    if (event === 'issue_comment' && action === 'created') {
      await handleIssueCommentCreated(payload);
    }

    if (event === 'pull_request' && action === 'closed') {
      const pr = payload.pull_request as { merged: boolean } | undefined;
      if (pr?.merged) {
        await handlePRMerged(payload);
      }
    }

    if (event === 'installation') {
      await handleInstallation(payload);
    }

    if (event === 'installation_repositories') {
      await handleInstallationRepositories(payload);
    }

    json(res, { ok: true });
  } catch (err) {
    console.error('[Webhook] Handler error:', err);
    json(res, { error: 'Internal server error' }, 500);
  }
}
