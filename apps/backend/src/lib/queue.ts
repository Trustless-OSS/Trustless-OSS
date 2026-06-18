import { Queue, QueueEvents } from 'bullmq';
import { redisClient } from './redis.js';

/* ------------------------------------------------------------------ */
/* Queues Initialization                                              */
/* ------------------------------------------------------------------ */

export const webhooksQueue = new Queue('webhooks', {
  connection: redisClient as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const escrowOperationsQueue = new Queue('escrow-operations', {
  connection: redisClient as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const syncQueue = new Queue('sync', {
  connection: redisClient as any,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

/* ------------------------------------------------------------------ */
/* Queue Events Logging                                               */
/* ------------------------------------------------------------------ */

const setupLogging = (queueName: string) => {
  const queueEvents = new QueueEvents(queueName, { connection: redisClient as any });

  queueEvents.on('added', ({ jobId }) => {
    console.log(`[Queue:${queueName}] 📥 Job added (ID: ${jobId})`);
  });

  queueEvents.on('active', ({ jobId }) => {
    console.log(`[Queue:${queueName}] ⚙️ Job started (ID: ${jobId})`);
  });

  queueEvents.on('completed', ({ jobId }) => {
    console.log(`[Queue:${queueName}] ✅ Job completed (ID: ${jobId})`);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`[Queue:${queueName}] ❌ Job failed (ID: ${jobId})`, failedReason);
  });
};

export const initializeQueues = () => {
  setupLogging('webhooks');
  setupLogging('escrow-operations');
  setupLogging('sync');
  console.log('[Queue] BullMQ queues initialized successfully');
};
