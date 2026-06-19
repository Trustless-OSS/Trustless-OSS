import 'dotenv/config';
import http from 'http';
import dns from 'dns';
import appHandler from './handler/app_handler';
import { disconnectRedis } from './lib/redis.js';
import { logger } from './lib/logger.js';
import { performHealthCheck, closeDbPool } from './lib/monitoring.js';

const log = logger.child({ module: 'server' });

// Fix for Node 18+ Undici fetch timing out on IPv6 addresses
dns.setDefaultResultOrder('ipv4first');

const server = http.createServer((req, res) => {
  void appHandler(req, res);
});

const PORT = parseInt(process.env.PORT ?? '4000', 10);

const healthLog = logger.child({ module: 'health-monitor' });

async function runPeriodicHealthCheck() {
  try {
    const health = await performHealthCheck('readiness');
    if (health.status === 'ok') {
      healthLog.info({ health }, 'Periodic health check: OK');
    } else {
      healthLog.warn({ health }, 'Periodic health check: DEGRADED/UNHEALTHY');
    }
  } catch (err: any) {
    healthLog.error({ err: err.message }, 'Periodic health check failed with error');
  }
}

server.listen(PORT, () => {
  log.info({ port: PORT }, 'Trustless OSS Backend running');

  // Run once on startup (after 5 seconds)
  setTimeout(() => {
    void runPeriodicHealthCheck();
  }, 5000);

  // Log health check results every 5 minutes
  setInterval(
    () => {
      void runPeriodicHealthCheck();
    },
    5 * 60 * 1000
  );
});

const shutdown = (signal: string) => {
  log.info({ signal }, 'shutting down gracefully');
  server.close((err) => {
    if (err) {
      log.error({ err }, 'error during shutdown');
      process.exit(1);
      return;
    }
    log.info('HTTP server closed');

    Promise.all([disconnectRedis(), closeDbPool()])
      .then(() => {
        log.info('Redis and DB connections disconnected');
        process.exit(0);
      })
      .catch((disconnectErr) => {
        log.error({ err: disconnectErr }, 'error during graceful disconnection');
        process.exit(1);
      });
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
