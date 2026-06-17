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
import { logger } from '../lib/logger.js';

const log = logger.child({ module: 'webhook-route' });

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
    log.error({ err, event, action }, 'webhook handler error');
    json(res, { error: 'Internal server error' }, 500);
  }
}
