import 'dotenv/config';
import http from 'http';
import dns from 'dns';
import appHandler from './handler/app_handler';
import { disconnectRedis } from './lib/redis.js';
import { logger } from './lib/logger.js';

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

const shutdown = (signal: string) => {
  log.info({ signal }, 'shutting down gracefully');
  server.close((err) => {
    if (err) {
      log.error({ err }, 'error during shutdown');
      process.exit(1);
      return;
    }
    log.info('HTTP server closed');

    disconnectRedis()
      .then(() => {
        log.info('Redis client disconnected');
        process.exit(0);
      })
      .catch((redisErr) => {
        log.error({ err: redisErr }, 'error during Redis disconnection');
        process.exit(1);
      });
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
