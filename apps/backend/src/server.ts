import 'dotenv/config';
import http from 'http';
import dns from 'dns';
import appHandler from './handler/app_handler';
import { disconnectRedis } from './lib/redis.js';

// Fix for Node 18+ Undici fetch timing out on IPv6 addresses
dns.setDefaultResultOrder('ipv4first');

const server = http.createServer((req, res) => {
  void appHandler(req, res);
});

const PORT = parseInt(process.env.PORT ?? '4000', 10);

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║  Trustless OSS Backend                    ║
║  Running on http://localhost:${PORT}          ║
╚═══════════════════════════════════════════╝
  `);
});

const shutdown = (signal: string) => {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);
  server.close((err) => {
    if (err) {
      console.error('[Server] Error during shutdown:', err);
      process.exit(1);
      return;
    }
    console.log('[Server] HTTP server closed.');

    disconnectRedis()
      .then(() => {
        console.log('[Redis] Client disconnected.');
        process.exit(0);
      })
      .catch((redisErr) => {
        console.error('[Redis] Error during disconnection:', redisErr);
        process.exit(1);
      });
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
