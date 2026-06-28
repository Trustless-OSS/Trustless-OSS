import SmeeClient from 'smee-client';
import { logger } from './lib/logger.js';

const log = logger.child({ module: 'webhook-proxy' });

const smee = new SmeeClient({
  source: 'https://smee.io/trustless-oss-dev-webhook',
  target: 'http://localhost:5000/api/webhooks/github',
  logger: console,
});

void smee.start().then((events) => {
  log.info(
    'Smee webhook proxy started — forwarding from https://smee.io/trustless-oss-dev-webhook to http://localhost:5000/api/webhooks/github'
  );

  process.on('SIGINT', () => {
    events.close();
    process.exit();
  });
});
