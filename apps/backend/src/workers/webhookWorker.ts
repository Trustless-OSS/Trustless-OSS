import { Worker, Job } from 'bullmq';
import { redisConnection } from '../lib/redis.js';
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

export const startWebhookWorker = () => {
  const worker = new Worker(
    'webhooks',
    async (job: Job) => {
      const { event, action, payload } = job.data;

      console.log(`[Worker:webhooks] Processing job ${job.id} for event ${event}.${action ?? ''}`);

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
    },
    { connection: redisConnection as any }
  );

  worker.on('error', (err) => {
    console.error('[Worker:webhooks] ❌ Error:', err);
  });

  return worker;
};
