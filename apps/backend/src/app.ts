import 'dotenv/config';
import cron from 'node-cron';
import { initializeQueues, webhooksQueue, escrowOperationsQueue, syncQueue } from './lib/queue.js';
import { startWebhookWorker } from './workers/webhookWorker.js';
import { startSyncWorker } from './workers/syncWorker.js';
import { routers } from './router.js';
import { githubWebhookHandler } from './routes/webhooks.js';
import { debugAuthHandler } from './routes/debug.js';
import { logger } from './lib/logger.js';
import {
  connectRepoHandler,
  createEscrowUnsignedHandler,
  listReposHandler,
  listIssuesHandler,
  pushMilestoneHandler,
  saveWalletHandler,
  getContributorHandler,
  healthHandler,
  submitDeployEscrowHandler,
  fundEscrowUnsignedHandler,
  submitFundEscrowHandler,
  updateRepoRewardsHandler,
  retryIssueHandler,
  refundEscrowHandler,
  closeEscrowUnsignedHandler,
  submitCloseHandler,
  deleteRepoHandler,
  queueStatsHandler,
} from './routes/api.js';

const log = logger.child({ module: 'app-init' });

initializeQueues();

const webhookWorker = startWebhookWorker();
const syncWorker = startSyncWorker();

// Background cron job: enqueue escrow balance sync every 60s onto sync queue
const cronJob = cron.schedule('* * * * *', () => {
  log.info('Cron triggered: enqueuing escrow-balance-sync job');
  void syncQueue.add('escrow-balance-sync', {}).catch((err) => {
    log.error({ err }, 'Failed to enqueue escrow balance sync job');
  });
});

// Setup graceful shutdown hooks
export const shutdownHooks: Array<() => Promise<void>> = [];

shutdownHooks.push(() => {
  log.info('Stopping cron scheduler...');
  void cronJob.stop();
  log.info('Cron scheduler stopped.');
  return Promise.resolve();
});

shutdownHooks.push(async () => {
  log.info('Stopping webhook and sync workers...');
  await Promise.all([webhookWorker.close(), syncWorker.close()]);
  log.info('Webhook and sync workers stopped.');
});

shutdownHooks.push(async () => {
  log.info('Closing queues connections...');
  await Promise.all([webhooksQueue.close(), escrowOperationsQueue.close(), syncQueue.close()]);
  log.info('Queues connections closed.');
});

/* ------------------------------------------------------------------ */
/* Register routes                                                      */
/* ------------------------------------------------------------------ */

// Health
routers('GET', '/api/health', healthHandler);

// Debug (remove before going public with sensitive repos)
routers('GET', '/api/debug/auth', debugAuthHandler);

// GitHub webhook
routers('POST', '/api/webhooks/github', githubWebhookHandler);

// Queue Stats
routers('GET', '/api/queue/stats', queueStatsHandler);

// Repos
routers('GET', '/api/repos', listReposHandler);
routers('POST', '/api/repos/connect', connectRepoHandler);
routers('GET', '/api/repos/:repoId/issues', listIssuesHandler);
routers('PUT', '/api/repos/:repoId/rewards', updateRepoRewardsHandler);
routers('DELETE', '/api/repos/:repoId', deleteRepoHandler);

// Escrow
routers('POST', '/api/escrow/create-unsigned', createEscrowUnsignedHandler);
routers('POST', '/api/escrow/submit-deploy', submitDeployEscrowHandler);
routers('POST', '/api/escrow/fund-unsigned', fundEscrowUnsignedHandler);
routers('POST', '/api/escrow/submit-fund', submitFundEscrowHandler);
routers('POST', '/api/escrow/refund', refundEscrowHandler);
routers('POST', '/api/escrow/close-unsigned', closeEscrowUnsignedHandler);
routers('POST', '/api/escrow/submit-close', submitCloseHandler);

// Milestones
routers('POST', '/api/milestones/push', pushMilestoneHandler);
routers('POST', '/api/issues/:issueId/retry', retryIssueHandler);

// Wallet
routers('POST', '/api/wallet/connect', saveWalletHandler);

// Contributor profile
routers('GET', '/api/contributor/me', getContributorHandler);
