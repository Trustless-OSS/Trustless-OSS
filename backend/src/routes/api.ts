import type { IncomingMessage, ServerResponse } from 'http';
import { readBody, json } from '../router.js';
import { supabase } from '../lib/supabase.js';
import { createRepoEscrow, fundEscrow } from '../lib/trustless-work/escrow.js';
import { pushMilestoneOnChain } from '../lib/trustless-work/milestone.js';
import type { Repo, Issue, Contributor, Assignment } from '../types/index.js';

/* ------------------------------------------------------------------ */
/* POST /api/repos/connect                                              */
/* Body: { githubRepoId, fullName, ownerGithubId, ownerUsername }      */
/* ------------------------------------------------------------------ */
export async function connectRepoHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as {
    githubRepoId: number;
    fullName: string;
    ownerGithubId: number;
    ownerUsername: string;
    ghToken: string;
  };

  // Determine the correct webhook URL
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['host'];
  const defaultWebhook = host
    ? `${protocol}://${host}/api/webhooks/github`
    : 'https://smee.io/trustless-oss-dev-webhook';

  const webhookUrl = process.env.WEBHOOK_URL ?? defaultWebhook;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET!;

  try {
    // First check if our webhook already exists to avoid duplicates
    const existingHooks = await fetch(`https://api.github.com/repos/${body.fullName}/hooks`, {
      headers: {
        Authorization: `Bearer ${body.ghToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    let alreadyExists = false;
    if (existingHooks.ok) {
      const hooks = await existingHooks.json() as Array<{ config: { url: string } }>;
      alreadyExists = hooks.some(h => h.config?.url === webhookUrl);
    }

    if (!alreadyExists) {
      const createRes = await fetch(`https://api.github.com/repos/${body.fullName}/hooks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${body.ghToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['issues', 'pull_request', 'issue_comment'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: webhookSecret,
            insecure_ssl: '0',
          },
        }),
      });

      if (createRes.ok) {
        console.log(`[GitHub] ✅ Webhook installed on ${body.fullName} → ${webhookUrl}`);
      } else {
        const errText = await createRes.text();
        console.error(`[GitHub] ❌ Failed to install webhook on ${body.fullName}: ${createRes.status} ${errText}`);
      }
    } else {
      console.log(`[GitHub] Webhook already exists on ${body.fullName}, skipping.`);
    }
  } catch (err) {
    console.error(`[GitHub] Exception while installing webhook:`, err);
  }

  const { data, error } = await supabase
    .from('repos')
    .upsert(
      {
        github_repo_id: body.githubRepoId,
        full_name: body.fullName,
        owner_github_id: body.ownerGithubId,
        owner_username: body.ownerUsername,
        reward_low: 0.01,
        reward_medium: 0.02,
        reward_high: 0.03,
      },
      { onConflict: 'github_repo_id' }
    )
    .select()
    .single<Repo>();

  if (error) { json(res, { error: error.message }, 400); return; }
  json(res, { repo: data });
}

/* ------------------------------------------------------------------ */
/* POST /api/escrow/create-unsigned                                     */
/* Body: { repoId, maintainerWallet }                                  */
/* ------------------------------------------------------------------ */
export async function createEscrowUnsignedHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { repoId: string; maintainerWallet: string };

  const { data: repo } = await supabase.from('repos').select('*').eq('id', body.repoId).single<Repo>();
  if (!repo) { json(res, { error: 'Repo not found' }, 404); return; }

  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;
  const TESTNET_USDC = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

  try {
    const { twFetch } = await import('../lib/trustless-work/client.js');
    const response = await twFetch('/deployer/multi-release', {
      method: 'POST',
      body: JSON.stringify({
        signer: body.maintainerWallet,
        engagementId: `repo-${Date.now()}`,
        title: `OSS Bounty: ${repo.full_name}`,
        description: `Escrow for OSS bounty rewards in ${repo.full_name}`,
        roles: {
          approver: platformKey,      // platform auto-approves on PR merge
          serviceProvider: platformKey,
          platformAddress: platformKey,
          releaseSigner: platformKey, // platform auto-releases
          disputeResolver: body.maintainerWallet, // maintainer resolves disputes
        },
        platformFee: 0,
        milestones: [{ description: `Initial Escrow Setup and fees of platform 0.01 USDC`, amount: 0.01, receiver: platformKey }],
        trustline: { address: TESTNET_USDC, symbol: 'USDC' },
      }),
    }) as { unsignedTransaction: string };

    json(res, { unsignedTransaction: response.unsignedTransaction });
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/escrow/submit-deploy                                       */
/* Body: { repoId, signedXdr }                                         */
/* ------------------------------------------------------------------ */
export async function submitDeployEscrowHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { repoId: string; signedXdr: string };

  try {
    const { twFetch } = await import('../lib/trustless-work/client.js');
    const result = await twFetch('/helper/send-transaction', {
      method: 'POST',
      body: JSON.stringify({ signedXdr: body.signedXdr }),
    }) as { contractId: string };

    await supabase.from('repos').update({ escrow_contract_id: result.contractId }).eq('id', body.repoId);
    json(res, { contractId: result.contractId });
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/escrow/fund-unsigned                                       */
/* Body: { repoId, amount, funderWallet }                               */
/* ------------------------------------------------------------------ */
export async function fundEscrowUnsignedHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { repoId: string; amount: number; funderWallet: string };

  const { data: repo } = await supabase.from('repos').select('*').eq('id', body.repoId).single<Repo>();
  if (!repo?.escrow_contract_id) { json(res, { error: 'No escrow deployed' }, 400); return; }

  try {
    const { twFetch } = await import('../lib/trustless-work/client.js');
    const response = await twFetch('/escrow/multi-release/fund-escrow', {
      method: 'POST',
      body: JSON.stringify({
        contractId: repo.escrow_contract_id,
        signer: body.funderWallet,
        amount: body.amount,
      }),
    }) as { unsignedTransaction: string };

    json(res, { unsignedTransaction: response.unsignedTransaction });
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/escrow/submit-fund                                         */
/* Body: { repoId, amount, signedXdr }                                  */
/* ------------------------------------------------------------------ */
export async function submitFundEscrowHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { repoId: string; amount: number; signedXdr: string };

  try {
    const { twFetch } = await import('../lib/trustless-work/client.js');
    await twFetch('/helper/send-transaction', {
      method: 'POST',
      body: JSON.stringify({ signedXdr: body.signedXdr }),
    });

    const { data: repo } = await supabase.from('repos').select('*').eq('id', body.repoId).single<Repo>();
    if (repo) {
      const newBalance = repo.escrow_balance + body.amount;
      await supabase.from('repos').update({ escrow_balance: newBalance }).eq('id', repo.id);
      json(res, { ok: true, newBalance });
    } else {
      json(res, { ok: true });
    }
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/escrow/withdraw-unsigned                                  */
/* Body: { repoId, amount, maintainerWallet }                          */
/* ------------------------------------------------------------------ */
export async function withdrawEscrowUnsignedHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { repoId: string; amount: number; maintainerWallet: string };

  const { data: repo } = await supabase.from('repos').select('*').eq('id', body.repoId).single<Repo>();
  if (!repo?.escrow_contract_id) { json(res, { error: 'No escrow deployed' }, 400); return; }

  try {
    const { twFetch } = await import('../lib/trustless-work/client.js');
    const { Transaction, Keypair, Networks } = await import('stellar-sdk');

    const networkPassphrase = process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    const platformSecret = process.env.PLATFORM_STELLAR_SECRET_KEY!;
    const platformPair = Keypair.fromSecret(platformSecret);

    // 1. Try to release the setup milestone (milestone 0) just in case it's blocking
    try {
      console.log('[Withdraw] Attempting to clear setup milestone (0)...');
      
      // Approve milestone 0
      try {
        const appRes = await twFetch('/escrow/multi-release/approve-milestone', {
          method: 'POST',
          body: JSON.stringify({
            contractId: repo.escrow_contract_id,
            signer: platformPair.publicKey(),
            milestoneIndex: 0,
          }),
        }) as { unsignedTransaction: string };

        if (appRes.unsignedTransaction) {
          const tx = new Transaction(appRes.unsignedTransaction, networkPassphrase);
          tx.sign(platformPair);
          await twFetch('/helper/send-transaction', {
            method: 'POST',
            body: JSON.stringify({ signedXdr: tx.toXDR() }),
          });
        }
      } catch (e: any) {
        console.log('[Withdraw] Approval skip:', e.message);
      }

      // Release milestone 0
      try {
        const relRes = await twFetch('/escrow/multi-release/release-milestone-funds', {
          method: 'POST',
          body: JSON.stringify({
            contractId: repo.escrow_contract_id,
            signer: platformPair.publicKey(),
            milestoneIndex: 0,
          }),
        }) as { unsignedTransaction: string };

        if (relRes.unsignedTransaction) {
          const tx = new Transaction(relRes.unsignedTransaction, networkPassphrase);
          tx.sign(platformPair);
          await twFetch('/helper/send-transaction', {
            method: 'POST',
            body: JSON.stringify({ signedXdr: tx.toXDR() }),
          });
        }
      } catch (e: any) {
        console.log('[Withdraw] Release skip:', e.message);
      }
      
      console.log('[Withdraw] Setup milestone cleared. Waiting for settlement...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (err: any) {
      console.log('[Withdraw] Setup milestone cleanup skipped/failed:', err.message);
    }

    // 2. Fetch the REAL on-chain balance to ensure distribution matches perfectly
    const balanceInfo = await twFetch('/escrow/get-multiple-escrow-balance', {
      method: 'POST',
      body: JSON.stringify({ contractIds: [repo.escrow_contract_id] }),
    }) as Array<{ balance: number }>;
    
    const onChainBalance = balanceInfo[0]?.balance ?? repo.escrow_balance;
    console.log('[Withdraw] On-chain balance:', onChainBalance);

    // 3. Now generate the sweep transaction
    const requestBody = {
      contractId: repo.escrow_contract_id,
      disputeResolver: body.maintainerWallet,
      distributions: [
        {
          address: body.maintainerWallet,
          amount: onChainBalance
        }
      ]
    };
    
    const response = await twFetch('/escrow/multi-release/withdraw-remaining-funds', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    }) as { unsignedTransaction: string };

    json(res, { unsignedTransaction: response.unsignedTransaction });
  } catch (err: any) {
    console.error('[Withdraw] Error from TrustlessWork:', err.message);
    json(res, { error: err.message }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/escrow/submit-withdraw                                     */
/* Body: { repoId, amount, signedXdr }                                  */
/* ------------------------------------------------------------------ */
export async function submitWithdrawHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { repoId: string; amount: number; signedXdr: string };

  try {
    const { twFetch } = await import('../lib/trustless-work/client.js');
    await twFetch('/helper/send-transaction', {
      method: 'POST',
      body: JSON.stringify({ signedXdr: body.signedXdr }),
    });

    const { data: repo } = await supabase.from('repos').select('*').eq('id', body.repoId).single<Repo>();
    if (repo) {
      // After a full sweep, the available unassigned balance is 0
      await supabase.from('repos').update({ escrow_balance: 0 }).eq('id', repo.id);
      json(res, { ok: true, newBalance: 0 });
    } else {
      json(res, { ok: true });
    }
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/escrow/close-unsigned                                     */
/* Body: { repoId, maintainerWallet }                                  */
/* ------------------------------------------------------------------ */
export async function closeEscrowUnsignedHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { repoId: string; maintainerWallet: string };

  const { data: repo } = await supabase.from('repos').select('*').eq('id', body.repoId).single<Repo>();
  if (!repo?.escrow_contract_id) { json(res, { error: 'No escrow deployed' }, 400); return; }

  try {
    const { twFetch } = await import('../lib/trustless-work/client.js');
    const response = await twFetch('/escrow/multi-release/close-escrow', {
      method: 'POST',
      body: JSON.stringify({
        contractId: repo.escrow_contract_id,
        signer: body.maintainerWallet,
      }),
    }) as { unsignedTransaction: string };

    json(res, { unsignedTransaction: response.unsignedTransaction });
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* POST /api/escrow/submit-close                                        */
/* Body: { repoId, signedXdr }                                         */
/* ------------------------------------------------------------------ */
export async function submitCloseHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { repoId: string; signedXdr: string };

  try {
    const { twFetch } = await import('../lib/trustless-work/client.js');
    await twFetch('/helper/send-transaction', {
      method: 'POST',
      body: JSON.stringify({ signedXdr: body.signedXdr }),
    });

    await supabase.from('repos').update({ escrow_contract_id: null, escrow_balance: 0 }).eq('id', body.repoId);
    json(res, { ok: true });
  } catch (err: any) {
    json(res, { error: err.message }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* GET /api/repos                                                       */
/* Returns all repos for the authenticated user                        */
/* ------------------------------------------------------------------ */
export async function listReposHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  // GitHub user ID — present on GitHub OAuth logins
  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  const githubUsername = user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? '';

  console.log(`[API] listRepos: user=${user.id}, githubId=${githubId}, username=${githubUsername}`);

  if (!githubId || isNaN(githubId)) {
    console.error(`[API] listRepos: could not resolve GitHub ID from user metadata:`, JSON.stringify(user.user_metadata));
    // Fall back to username-based lookup
    if (githubUsername) {
      const { data, error } = await supabase
        .from('repos')
        .select('*')
        .eq('owner_username', githubUsername)
        .order('created_at', { ascending: false });
      if (error) { json(res, { error: error.message }, 400); return; }
      return json(res, { repos: data ?? [] });
    }
    json(res, { error: 'Could not determine GitHub identity from session' }, 400);
    return;
  }

  // Match repos where user is the owner OR the installer
  // (both fields are populated by the GitHub App installation webhook)
  const { data, error } = await supabase
    .from('repos')
    .select('*')
    .or(`owner_github_id.eq.${githubId},installer_github_id.eq.${githubId}`)
    .order('created_at', { ascending: false });

  console.log(`[API] listRepos: found ${data?.length ?? 0} repos for githubId=${githubId}`);

  if (error) { json(res, { error: error.message }, 400); return; }
  json(res, { repos: data ?? [] });
}

/* ------------------------------------------------------------------ */
/* GET /api/repos/:repoId/issues                                        */
/* ------------------------------------------------------------------ */
export async function listIssuesHandler(
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>
): Promise<void> {
  const { data, error } = await supabase
    .from('issues')
    .select('*, assignments(*, contributors(*))')
    .eq('repo_id', params.repoId!)
    .order('created_at', { ascending: false });

  if (error) { json(res, { error: error.message }, 400); return; }
  json(res, { issues: data });
}

/* ------------------------------------------------------------------ */
/* POST /api/milestones/push                                            */
/* Body: { githubIssueId, githubRepoId, wallet }                       */
/* Called after contributor connects their wallet                       */
/* ------------------------------------------------------------------ */
export async function pushMilestoneHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as {
    githubIssueId: number;
    githubRepoId: number;
    wallet: string;
  };

  // Save wallet to contributor
  const githubUserId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  await supabase.from('contributors').upsert(
    {
      github_user_id: githubUserId,
      github_username: user.user_metadata?.user_name ?? '',
      stellar_wallet: body.wallet,
    },
    { onConflict: 'github_user_id' }
  );

  // Look up the issue
  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('github_repo_id', body.githubRepoId)
    .single<Repo>();

  if (!repo) { json(res, { error: 'Repo not found' }, 404); return; }

  const { data: issue } = await supabase
    .from('issues')
    .select('*')
    .eq('repo_id', repo.id)
    .eq('github_issue_id', body.githubIssueId)
    .single<Issue>();

  if (!issue || (issue.status !== 'pending' && issue.status !== 'active')) {
    json(res, { error: 'Issue is not in a valid state to connect wallet' }, 400);
    return;
  }

  await pushMilestoneOnChain(repo, issue, body.wallet);

  // Post comment to GitHub
  try {
    const { postComment } = await import('../lib/github/comments.js');
    await postComment(
      repo.full_name,
      issue.github_issue_number,
      `✅ **Wallet Connected!** Bounty of **${issue.reward_amount} USDC** is now locked in escrow. Merge the PR to release the funds.`
    );
  } catch (e) {
    console.error('[API] Failed to post comment after wallet connect:', e);
  }

  json(res, { ok: true });
}

/* ------------------------------------------------------------------ */
/* POST /api/wallet/connect                                             */
/* Body: { wallet }  — saves stellar wallet for the authed user        */
/* ------------------------------------------------------------------ */
export async function saveWalletHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { wallet: string };

  const githubUserId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);

  const { error } = await supabase.from('contributors').upsert(
    {
      github_user_id: githubUserId,
      github_username: user.user_metadata?.user_name ?? '',
      stellar_wallet: body.wallet,
    },
    { onConflict: 'github_user_id' }
  );

  if (error) { json(res, { error: error.message }, 400); return; }
  json(res, { ok: true });
}

/* ------------------------------------------------------------------ */
/* GET /api/contributor/me                                              */
/* ------------------------------------------------------------------ */
export async function getContributorHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const githubUserId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);

  const { data } = await supabase
    .from('contributors')
    .select('*, assignments(*, issues(*))')
    .eq('github_user_id', githubUserId)
    .single<Contributor>();

  json(res, { contributor: data });
}

/* ------------------------------------------------------------------ */
/* PUT /api/repos/:repoId/rewards                                       */
/* Body: { reward_low, reward_medium, reward_high }                    */
/* ------------------------------------------------------------------ */
export async function updateRepoRewardsHandler(
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>
): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as {
    reward_low: number;
    reward_medium: number;
    reward_high: number;
  };

  // Validate amounts
  if (body.reward_low < 0 || body.reward_medium < 0 || body.reward_high < 0) {
    json(res, { error: 'Reward amounts must be non-negative' }, 400);
    return;
  }

  const { data, error } = await supabase
    .from('repos')
    .update({
      reward_low: body.reward_low,
      reward_medium: body.reward_medium,
      reward_high: body.reward_high,
    })
    .eq('id', params.repoId!)
    .select()
    .single<Repo>();

  if (error) { json(res, { error: error.message }, 400); return; }
  json(res, { repo: data });
}

/* ------------------------------------------------------------------ */
/* POST /api/issues/:issueId/retry                                      */
/* ------------------------------------------------------------------ */
export async function retryIssueHandler(
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>
): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const { data: issue } = await supabase
    .from('issues')
    .select('*, repos(*)')
    .eq('id', params.issueId!)
    .single<Issue & { repos: Repo }>();

  if (!issue) { json(res, { error: 'Issue not found' }, 404); return; }

  // Check if user is the repo owner
  if (Number(issue.repos.owner_github_id) !== Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub)) {
    json(res, { error: 'Only the repository owner can retry' }, 403);
    return;
  }

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*, contributors(*)')
    .eq('issue_id', issue.id)
    .single<Assignment>();

  if (!assignment) { json(res, { error: 'No assignment found' }, 400); return; }

  const { pushMilestoneOnChain, releaseEscrowMilestone } = await import('../lib/trustless-work/milestone.js');

  let currentIssue = { ...issue };

  // Step 1: If pending, try to push milestone
  if (currentIssue.status === 'pending') {
    if (!assignment.contributors?.stellar_wallet) {
      json(res, { error: 'Contributor has not connected a wallet yet' }, 400);
      return;
    }
    await pushMilestoneOnChain(issue.repos, currentIssue, assignment.contributors.stellar_wallet);
    json(res, { ok: true, step: 'pushed', status: 'active' });
    return;
  }

  // Step 2: If active, check if GitHub issue is closed to trigger release
  if (currentIssue.status === 'active') {
    // Verify GitHub status before releasing
    try {
      const ghRes = await fetch(`https://api.github.com/repos/${issue.repos.full_name}/issues/${issue.github_issue_number}`, {
        headers: {
          'Authorization': `token ${process.env.GITHUB_BOT_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Trustless-OSS-Bot'
        }
      });
      const ghIssue = await ghRes.json() as any;

      if (ghIssue.state !== 'closed') {
        json(res, { error: 'This issue is still open on GitHub. Please close it or merge the PR first.' }, 400);
        return;
      }
    } catch (e) {
      console.error('[API] Failed to verify GitHub issue state:', e);
      json(res, { error: 'Could not verify GitHub issue state' }, 500);
      return;
    }

    try {
      const txHash = await releaseEscrowMilestone(issue.repos, currentIssue);
      await supabase.from('assignments').update({ payout_status: 'released' }).eq('id', assignment.id);
      await supabase.from('issues').update({ status: 'completed' }).eq('id', currentIssue.id);
      json(res, { ok: true, step: 'released', txHash });
    } catch (releaseErr: any) {
      console.error('[API] releaseEscrowMilestone threw:', releaseErr.message);
      // Return the actual TW API error so the frontend can display it
      json(res, { error: `On-chain release failed: ${releaseErr.message}` }, 500);
    }
    return;
  }

  json(res, { ok: true, message: 'Process is already up to date' });
}

/* ------------------------------------------------------------------ */
/* GET /api/health                                                      */
/* ------------------------------------------------------------------ */
export async function healthHandler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  const health: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    checks: {}
  };

  try {
    // 1. Database Check
    const startDb = Date.now();
    const { error: dbError } = await supabase.from('repos').select('id', { count: 'exact', head: true }).limit(1);
    health.checks.database = {
      status: dbError ? 'error' : 'ok',
      latency: `${Date.now() - startDb}ms`,
      message: dbError?.message
    };

    // 2. Trustless Work API Check
    const startTw = Date.now();
    try {
      const { twFetch } = await import('../lib/trustless-work/client.js');
      await twFetch('/helper/health', { method: 'GET' });
      health.checks.trustless_work = {
        status: 'ok',
        latency: `${Date.now() - startTw}ms`
      };
    } catch (e: any) {
      health.checks.trustless_work = {
        status: 'degraded',
        error: e.message
      };
    }

    // 3. Environment Check (Required Variables)
    const requiredVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PLATFORM_STELLAR_PUBLIC_KEY',
      'GITHUB_BOT_TOKEN',
      'GITHUB_WEBHOOK_SECRET'
    ];
    const missing = requiredVars.filter(v => !process.env[v]);
    health.checks.environment = {
      status: missing.length === 0 ? 'ok' : 'error',
      missing_variables: missing.length > 0 ? missing : undefined
    };

    // If any critical check fails, return 503
    const isHealthy = health.checks.database.status === 'ok' && health.checks.environment.status === 'ok';
    if (!isHealthy) health.status = 'unhealthy';

    json(res, health, isHealthy ? 200 : 503);
  } catch (err: any) {
    json(res, { status: 'error', message: err.message }, 500);
  }
}

/* ------------------------------------------------------------------ */
/* util                                                                 */
/* ------------------------------------------------------------------ */

function getToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
