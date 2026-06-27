import 'dotenv/config';
import cron from 'node-cron';
import { initializeQueues, drainQueues } from './lib/queue.js';
import { startWebhookWorker } from './workers/webhookWorker.js';
import { startSyncWorker } from './workers/syncWorker.js';
import { routers } from './router.js';
import { githubWebhookHandler } from './routes/webhooks.js';
import { debugAuthHandler } from './routes/debug.js';
import { logger } from './lib/logger.js';
import { getCacheStats } from './lib/cache.js';
import type { Worker } from 'bullmq';
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
const workers: Worker[] = [webhookWorker, syncWorker];

const cronJob = cron.schedule('* * * * *', () => {
  log.info('Cron triggered: enqueuing escrow-balance-sync job');
  void import('./lib/queue.js').then(({ syncQueue }) => {
    syncQueue.add('escrow-balance-sync', {}).catch((err) => {
      log.error({ err }, 'Failed to enqueue escrow balance sync job');
    });
  });
});

const cacheStatsJob = cron.schedule('0 * * * *', () => {
  const stats = getCacheStats();
  for (const [type, typeStats] of Object.entries(stats)) {
    const total = typeStats.hits + typeStats.misses;
    if (total === 0) continue;
    log.info(
      {
        cacheType: type,
        hits: typeStats.hits,
        misses: typeStats.misses,
        hitRate: typeStats.hitRate !== null ? `${(typeStats.hitRate * 100).toFixed(1)}%` : 'n/a',
      },
      'Cache hit/miss stats (hourly)'
    );
  }
});

export function stopSchedulers(): void {
  log.info('Stopping cron schedulers');
  void cronJob.stop();
  void cacheStatsJob.stop();
  log.info('Cron schedulers stopped');
}

export async function drainJobQueues(timeoutMs = 120_000): Promise<void> {
  await drainQueues(workers, timeoutMs);
}

/* ------------------------------------------------------------------ */
/* Register routes                                                      */
/* ------------------------------------------------------------------ */

routers('GET', '/api/health', healthHandler);
routers('GET', '/api/debug/auth', debugAuthHandler);
routers('POST', '/api/webhooks/github', githubWebhookHandler);
routers('GET', '/api/queue/stats', queueStatsHandler);
routers('GET', '/api/repos', listReposHandler);
routers('POST', '/api/repos/connect', connectRepoHandler);
routers('GET', '/api/repos/:repoId/issues', listIssuesHandler);
routers('PUT', '/api/repos/:repoId/rewards', updateRepoRewardsHandler);
routers('DELETE', '/api/repos/:repoId', deleteRepoHandler);
routers('POST', '/api/escrow/create-unsigned', createEscrowUnsignedHandler);
routers('POST', '/api/escrow/submit-deploy', submitDeployEscrowHandler);
routers('POST', '/api/escrow/fund-unsigned', fundEscrowUnsignedHandler);
routers('POST', '/api/escrow/submit-fund', submitFundEscrowHandler);
routers('POST', '/api/escrow/refund', refundEscrowHandler);
routers('POST', '/api/escrow/close-unsigned', closeEscrowUnsignedHandler);
routers('POST', '/api/escrow/submit-close', submitCloseHandler);
routers('POST', '/api/milestones/push', pushMilestoneHandler);
routers('POST', '/api/issues/:issueId/retry', retryIssueHandler);
routers('POST', '/api/wallet/connect', saveWalletHandler);
routers('GET', '/api/contributor/me', getContributorHandler);
