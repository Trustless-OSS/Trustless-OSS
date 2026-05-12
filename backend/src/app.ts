import 'dotenv/config';
import http from 'http';
import { addRoute, dispatch, json } from './router.js';
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
  withdrawEscrowUnsignedHandler,
  submitWithdrawHandler,
  closeEscrowUnsignedHandler,
  submitCloseHandler,
} from './routes/api.js';

/* ------------------------------------------------------------------ */
/* Register routes                                                      */
/* ------------------------------------------------------------------ */

// Health
addRoute('GET', '/api/health', healthHandler);

// Debug (remove before going public with sensitive repos)
addRoute('GET', '/api/debug/auth', debugAuthHandler);

// GitHub webhook
addRoute('POST', '/api/webhooks/github', githubWebhookHandler);

// Repos
addRoute('GET', '/api/repos', listReposHandler);
addRoute('POST', '/api/repos/connect', connectRepoHandler);
addRoute('GET', '/api/repos/:repoId/issues', listIssuesHandler);
addRoute('PUT', '/api/repos/:repoId/rewards', updateRepoRewardsHandler);

// Escrow
addRoute('POST', '/api/escrow/create-unsigned', createEscrowUnsignedHandler);
addRoute('POST', '/api/escrow/submit-deploy', submitDeployEscrowHandler);
addRoute('POST', '/api/escrow/fund-unsigned', fundEscrowUnsignedHandler);
addRoute('POST', '/api/escrow/submit-fund', submitFundEscrowHandler);
addRoute('POST', '/api/escrow/withdraw-unsigned', withdrawEscrowUnsignedHandler);
addRoute('POST', '/api/escrow/submit-withdraw', submitWithdrawHandler);
addRoute('POST', '/api/escrow/close-unsigned', closeEscrowUnsignedHandler);
addRoute('POST', '/api/escrow/submit-close', submitCloseHandler);

// Milestones
addRoute('POST', '/api/milestones/push', pushMilestoneHandler);
addRoute('POST', '/api/issues/:issueId/retry', retryIssueHandler);

// Wallet
addRoute('POST', '/api/wallet/connect', saveWalletHandler);

// Contributor profile
addRoute('GET', '/api/contributor/me', getContributorHandler);

/* ------------------------------------------------------------------ */
/* App Handler                                                          */
/* ------------------------------------------------------------------ */

const ALLOWED_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:3000';

export default async function appHandler(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    await dispatch(req, res);
  } catch (err) {
    console.error('[Server] Unhandled error:', err);
    if (!res.headersSent) {
      json(res, { error: 'Internal Server Error' }, 500);
    }
  }
}
