import { Worker, Job } from 'bullmq';
import { redisClient } from '../lib/redis.js';
import { processWebhookJob } from '../lib/queue-processors.js';

export const startWebhookWorker = () => {
  const worker = new Worker(
    'webhooks',
    async (job: Job) => {
      await processWebhookJob(job);
    },
    { connection: redisClient as any }
  );

  worker.on('error', (err) => {
    console.error('[Worker:webhooks] ❌ Error:', err);
  });

  return worker;
};
