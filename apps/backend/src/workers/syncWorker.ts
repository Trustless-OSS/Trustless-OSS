import { Worker, Job } from 'bullmq';
import { redisClient } from '../lib/redis.js';
import { syncAllEscrowBalances } from '../lib/queue-processors.js';
import { logger } from '../lib/logger.js';

const log = logger.child({ module: 'sync-worker' });

export const startSyncWorker = () => {
  const worker = new Worker(
    'sync',
    async (job: Job) => {
      log.info(`[Worker:sync] Processing job ${job.id} of type ${job.name}`);
      if (job.name === 'escrow-balance-sync') {
        await syncAllEscrowBalances();
      } else {
        log.warn(`[Worker:sync] Unknown job type: ${job.name}`);
      }
    },
    { connection: redisClient as any }
  );

  worker.on('error', (err) => {
    log.error({ err }, '[Worker:sync] ❌ Error');
  });

  return worker;
};
