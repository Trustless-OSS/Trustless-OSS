import 'dotenv/config';
import http from 'http';
import dns from 'dns';
import appHandler from './handler/app_handler';
import { disconnectRedis } from './lib/redis.js';
import { logger } from './lib/logger.js';
import { shutdownHooks } from './app.js';

const log = logger.child({ module: 'server' });

// Fix for Node 18+ Undici fetch timing out on IPv6 addresses
dns.setDefaultResultOrder('ipv4first');

const server = http.createServer((req, res) => {
  void appHandler(req, res);
});

const PORT = parseInt(process.env.PORT ?? '4000', 10);

server.listen(PORT, () => {
  log.info({ port: PORT }, 'Trustless OSS Backend running');
});

const shutdown = async (signal: string) => {
  log.info({ signal }, 'shutting down gracefully');

  const forceExitTimeout = setTimeout(() => {
    log.error('Graceful shutdown timed out (2 min). Forcing exit.');
    process.exit(1);
  }, 120_000);

  try {
    // 1. Run app-level graceful shutdown hooks (cron, workers, queues)
    log.info('Running app-level graceful shutdown hooks...');
    for (const hook of shutdownHooks) {
      try {
        await hook();
      } catch (hookErr) {
        log.error({ err: hookErr }, 'Error during shutdown hook execution');
      }
    }
    log.info('App-level graceful shutdown hooks completed.');

    // 2. Close HTTP Server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) {
          log.error({ err }, 'Error closing HTTP server');
          reject(err);
        } else {
          log.info('HTTP server closed');
          resolve();
        }
      });
    });

    // 3. Disconnect Redis
    await disconnectRedis();
    log.info('Redis client disconnected');

    clearTimeout(forceExitTimeout);
    log.info('Graceful shutdown completed successfully.');
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
