import { Queue, QueueEvents, Worker } from 'bullmq';
import { redisClient } from './redis.js';
import { logger } from './logger.js';

const log = logger.child({ module: 'queue' });

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
    removeOnComplete: {
      age: 300,
    },
    removeOnFail: {
      age: 86400,
    },
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
    removeOnComplete: {
      age: 300,
    },
    removeOnFail: {
      age: 86400,
    },
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
    removeOnComplete: {
      age: 300,
    },
    removeOnFail: {
      age: 86400,
    },
  },
});

const allQueues = [webhooksQueue, escrowOperationsQueue, syncQueue];

/* ------------------------------------------------------------------ */
/* Queue Events Logging                                               */
/* ------------------------------------------------------------------ */

const setupLogging = (queueName: string) => {
  const queueEvents = new QueueEvents(queueName, { connection: redisClient as any });

  queueEvents.on('added', ({ jobId }) => {
    log.debug({ queueName, jobId }, 'job added');
  });

  queueEvents.on('active', ({ jobId }) => {
    log.debug({ queueName, jobId }, 'job started');
  });

  queueEvents.on('completed', ({ jobId }) => {
    log.debug({ queueName, jobId }, 'job completed');
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    log.error({ queueName, jobId, failedReason }, 'job failed');
  });
};

export const initializeQueues = () => {
  setupLogging('webhooks');
  setupLogging('escrow-operations');
  setupLogging('sync');
  log.info('BullMQ queues initialized successfully');
};

/**
 * Drain active workers and close queue connections.
 * Waits up to timeoutMs for workers to finish active jobs.
 */
export async function drainQueues(workers: Worker[], timeoutMs = 120_000): Promise<void> {
  log.info({ workerCount: workers.length, timeoutMs }, 'Draining job queue workers');

  const closeWorkers = Promise.all(
    workers.map(async (worker) => {
      try {
        await worker.close();
      } catch (err) {
        log.error({ err, queue: worker.name }, 'Error closing worker');
      }
    })
  );

  const timeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      log.warn({ timeoutMs }, 'Queue drain timed out — proceeding with shutdown');
      resolve();
    }, timeoutMs);
  });

  await Promise.race([closeWorkers, timeout]);

  log.info('Closing queue connections');
  await Promise.all(
    allQueues.map(async (queue) => {
      try {
        await queue.close();
      } catch (err) {
        log.error({ err, queue: queue.name }, 'Error closing queue');
      }
    })
  );

  log.info('Queue drain complete');
}

export async function closeQueues(): Promise<void> {
  await Promise.all(allQueues.map((queue) => queue.close()));
}
