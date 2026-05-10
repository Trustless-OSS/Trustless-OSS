import SmeeClient from 'smee-client';

const smee = new SmeeClient({
  source: 'https://smee.io/trustless-oss-dev-webhook',
  target: 'http://localhost:5000/api/webhooks/github',
  logger: console
});

const events = smee.start();
console.log('🔗 Smee webhook proxy started! Forwarding from https://smee.io/trustless-oss-dev-webhook to http://localhost:5000/api/webhooks/github');

// Stop on Ctrl+C
process.on('SIGINT', () => {
  events.close();
  process.exit();
});
