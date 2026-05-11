import 'dotenv/config';
import http from 'http';
import dns from 'dns';
import appHandler from './app.js';

// Fix for Node 18+ Undici fetch timing out on IPv6 addresses
dns.setDefaultResultOrder('ipv4first');

const server = http.createServer(appHandler);

const PORT = parseInt(process.env.PORT ?? '4000', 10);

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║  Trustless OSS Backend                    ║
║  Running on http://localhost:${PORT}          ║
╚═══════════════════════════════════════════╝
  `);
});
