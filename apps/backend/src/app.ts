import 'dotenv/config';
import { initializeQueues } from './lib/queue.js';
import { startWebhookWorker } from './workers/webhookWorker.js';
import { routers } from './router.js';
import { githubWebhookHandler } from './routes/webhooks.js';
import { debugAuthHandler } from './routes/debug.js';
import {
  connectRepoHandler,
  createEscrowUnsignedHandler,
  listReposHandler,
  listIssuesHandler,
  pushMilestoneHandler,
  saveWalletHandler,
  getContributorHandler,
  healthHandler,
  submitDeployEscrowHandler,
  fundEscrowUnsignedHandler,
  submitFundEscrowHandler,
  updateRepoRewardsHandler,
  retryIssueHandler,
  refundEscrowHandler,
  closeEscrowUnsignedHandler,
  submitCloseHandler,
  deleteRepoHandler,
} from './routes/api.js';

initializeQueues();
startWebhookWorker();
/* ------------------------------------------------------------------ */
/* Register routes                                                      */
/* ------------------------------------------------------------------ */

// Health
routers('GET', '/api/health', healthHandler);

// Debug (remove before going public with sensitive repos)
routers('GET', '/api/debug/auth', debugAuthHandler);

// GitHub webhook
routers('POST', '/api/webhooks/github', githubWebhookHandler);

// Repos
routers('GET', '/api/repos', listReposHandler);
routers('POST', '/api/repos/connect', connectRepoHandler);
routers('GET', '/api/repos/:repoId/issues', listIssuesHandler);
routers('PUT', '/api/repos/:repoId/rewards', updateRepoRewardsHandler);
routers('DELETE', '/api/repos/:repoId', deleteRepoHandler);

// Escrow
routers('POST', '/api/escrow/create-unsigned', createEscrowUnsignedHandler);
routers('POST', '/api/escrow/submit-deploy', submitDeployEscrowHandler);
routers('POST', '/api/escrow/fund-unsigned', fundEscrowUnsignedHandler);
routers('POST', '/api/escrow/submit-fund', submitFundEscrowHandler);
routers('POST', '/api/escrow/refund', refundEscrowHandler);
routers('POST', '/api/escrow/close-unsigned', closeEscrowUnsignedHandler);
routers('POST', '/api/escrow/submit-close', submitCloseHandler);

// Milestones
routers('POST', '/api/milestones/push', pushMilestoneHandler);
routers('POST', '/api/issues/:issueId/retry', retryIssueHandler);

// Wallet
routers('POST', '/api/wallet/connect', saveWalletHandler);

// Contributor profile
routers('GET', '/api/contributor/me', getContributorHandler);
