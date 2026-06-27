import 'dotenv/config';
import http from 'http';
import dns from 'dns';
import appHandler from './handler/app_handler';
import { disconnectRedis } from './lib/redis.js';
import { logger } from './lib/logger.js';
import {
  beginShutdown,
  waitForActiveRequests,
  closeDatabaseConnection,
  getActiveRequestCount,
} from './lib/lifecycle.js';
import { stopSchedulers, drainJobQueues } from './app.js';

const log = logger.child({ module: 'server' });

dns.setDefaultResultOrder('ipv4first');

const server = http.createServer((req, res) => {
  void appHandler(req, res);
});

const PORT = parseInt(process.env.PORT ?? '5000', 10);

server.listen(PORT, () => {
  log.info({ port: PORT }, 'Trustless OSS Backend running');
});

const HTTP_DRAIN_TIMEOUT_MS = 30_000;
const QUEUE_DRAIN_TIMEOUT_MS = 120_000;
const FORCE_EXIT_TIMEOUT_MS = 150_000;

const shutdown = async (signal: string) => {
  log.info({ signal }, 'Graceful shutdown sequence started');

  const forceExitTimeout = setTimeout(() => {
    log.error({ timeoutMs: FORCE_EXIT_TIMEOUT_MS }, 'Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS);

  try {
    // Step 1: Stop accepting new requests (503 via lifecycle flag)
    beginShutdown();
    log.info('Step 1/7 complete — new requests will receive 503');

    // Step 2: Stop accepting connections and wait for in-flight HTTP requests
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          log.error({ err }, 'Error closing HTTP server');
          reject(err);
        } else {
          log.info('HTTP server stopped accepting new connections');
          resolve();
        }
      });
    });

    await waitForActiveRequests(HTTP_DRAIN_TIMEOUT_MS);
    log.info(
      { remainingRequests: getActiveRequestCount() },
      'Step 2/7 complete — HTTP request drain finished'
    );

    // Step 3: Drain job queue (workers finish active jobs, max 2 min)
    await drainJobQueues(QUEUE_DRAIN_TIMEOUT_MS);
    log.info('Step 3/7 complete — job queue drained');

    // Step 4: Stop cache hit-rate logging scheduler and cron
    await stopSchedulers();
    log.info('Step 4/7 complete — schedulers stopped');

    // Step 5: Close Redis connection (after queue drain — jobs may write to cache)
    await disconnectRedis();
    log.info('Step 5/7 complete — Redis client disconnected');

    // Step 6: Close database connection
    closeDatabaseConnection();
    log.info('Step 6/7 complete — database connection closed');

    clearTimeout(forceExitTimeout);
    log.info('Step 7/7 complete — graceful shutdown finished successfully');
    process.exit(0);
  } catch (err) {
    log.error({ err }, 'Error during graceful shutdown process');
    process.exit(1);
  }
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
