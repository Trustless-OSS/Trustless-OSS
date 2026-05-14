import type { IncomingMessage, ServerResponse } from 'http';
import { readBody, json } from '../router.js';
import { supabase } from '../lib/supabase.js';
import { createRepoEscrow, fundEscrow } from '../lib/trustless-work/escrow.js';
import { pushMilestoneOnChain } from '../lib/trustless-work/milestone.js';
import type { Repo, Issue, Contributor, Assignment } from '../types/index.js';
import { isMaintainer, isAssignedContributor, isAssignedContributorById } from '../lib/auth.js';
import { postComment } from '../lib/github/comments.js';


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

  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  if (!(await isMaintainer(githubId, repo.id))) {
    json(res, { error: 'Forbidden: Only maintainers can perform this action' }, 403);
    return;
  }

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
          disputeResolver: 'GDC7GQGFJHEWFI3H6GAAYVYCUOPSENNUN2KDJBG3D5PFOX35FTRSYACX', // Hardcoded Resolver Wallet
        },
        platformFee: 0,
        milestones: [{ description: `Escrow Initialized`, amount: 0.01, receiver: platformKey }],
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

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }
  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);

  if (!(await isMaintainer(githubId, body.repoId))) {
    json(res, { error: 'Forbidden: Only maintainers can perform this action' }, 403);
    return;
  }

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
  console.log(`[Fund] Request for repo ${body.repoId}, amount: ${body.amount}, funder: ${body.funderWallet}`);

  if (!body.amount || body.amount <= 0 || !body.funderWallet) {
    json(res, { error: 'Invalid amount or funder wallet' }, 400);
    return;
  }

  const { data: repo } = await supabase.from('repos').select('*').eq('id', body.repoId).single<Repo>();
  if (!repo?.escrow_contract_id) { json(res, { error: 'No escrow deployed for this repository' }, 400); return; }

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'User not found' }, 401); return; }

  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  if (!(await isMaintainer(githubId, repo.id))) {
    json(res, { error: 'Forbidden: Only maintainers can fund the escrow' }, 403);
    return;
  }

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
/* POST /api/escrow/refund                                              */
/* Body: { repoId }                                                     */
/* ------------------------------------------------------------------ */
export async function refundEscrowHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as { repoId: string };
  const { repoId } = body;
  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);

  if (!(await isMaintainer(githubId, repoId))) {
    json(res, { error: 'Forbidden: Only maintainers can refund funds' }, 403);
    return;
  }

  // Fetch maintainer's stellar wallet
  const { data: maintainer } = await supabase.from('contributors').select('stellar_wallet').eq('github_user_id', githubId).single();
  if (!maintainer?.stellar_wallet) {
    json(res, { error: 'You must link your Stellar wallet before refunding' }, 400);
    return;
  }

  const { data: repo } = await supabase.from('repos').select('*').eq('id', repoId).single<Repo>();
  if (!repo || !repo.escrow_contract_id) {
    json(res, { error: 'Repo or escrow not found' }, 404);
    return;
  }

  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;
  let totalRefunded = 0;
  let cancelledCount = 0;

  try {
    const { twFetch } = await import('../lib/trustless-work/client.js');
    const { signAndSendTransaction } = await import('../lib/stellar/signer.js');

    // Fetch live escrow
    const escrowArray = await twFetch(`/helper/get-escrow-by-contract-ids?contractIds[]=${repo.escrow_contract_id}`) as Array<any>;
    const escrowData = escrowArray[0];
    if (!escrowData) throw new Error('Escrow not found on Trustless Work');

    const milestones = escrowData.milestones ?? [];
    
    // 2. Determine refund strategy based on roles
    const resolverPubKey = 'GDC7GQGFJHEWFI3H6GAAYVYCUOPSENNUN2KDJBG3D5PFOX35FTRSYACX';
    const resolverSecret = 'SBEWHMYXIJ6K5L22KX3ZU4VFQSYT53ELTWZQB65OERU6N5AJHQUIBCR6';
    const isDualWallet = escrowData.roles?.disputeResolver === resolverPubKey;

    if (isDualWallet) {
      console.log(`[Refund] Using dual-wallet Dispute+Resolve strategy for repo ${repo.full_name}`);
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        if (m.flags?.released || m.flags?.resolved) continue;

        // Dispute as Platform-Main (Approver)
        try {
          const disputeRes = await twFetch('/escrow/multi-release/dispute-milestone', {
            method: 'POST',
            body: JSON.stringify({
              signer: platformKey,
              contractId: repo.escrow_contract_id,
              milestoneIndex: String(i)
            })
          }) as { unsignedTransaction: string };
          await signAndSendTransaction(disputeRes.unsignedTransaction);
        } catch (err: any) {
          if (!err.message.includes('already in dispute')) throw err;
        }

        // Resolve as Platform-Resolver
        const resolveRes = await twFetch('/escrow/multi-release/resolve-milestone-dispute', {
          method: 'POST',
          body: JSON.stringify({
            disputeResolver: resolverPubKey,
            contractId: repo.escrow_contract_id,
            milestoneIndex: String(i),
            distributions: [{ address: maintainer.stellar_wallet, amount: Number(m.amount) }]
          })
        }) as { unsignedTransaction: string };
        await signAndSendTransaction(resolveRes.unsignedTransaction, resolverSecret);
        totalRefunded += Number(m.amount);
      }
    } else {
      // Legacy Strategy: Update + Release
      console.log(`[Refund] Using legacy Update+Release strategy for repo ${repo.full_name}`);
      const newMilestones = milestones.map((m: any) => {
        if (m.flags?.released || m.flags?.resolved) return { ...m, amount: Number(m.amount), evidence: m.evidence ?? '' };
        return {
          description: `Refund: ${m.description}`,
          amount: Number(m.amount),
          receiver: maintainer.stellar_wallet,
          status: 'pending',
          evidence: m.evidence ?? '',
          flags: { approved: false, released: false, disputed: false, resolved: false }
        };
      });

      const updateRes = await twFetch('/escrow/multi-release/update-escrow', {
        method: 'PUT',
        body: JSON.stringify({
          signer: platformKey,
          contractId: repo.escrow_contract_id,
          escrow: {
            engagementId: escrowData.engagementId,
            title: escrowData.title,
            description: escrowData.description,
            roles: escrowData.roles,
            platformFee: Number(escrowData.platformFee ?? 0),
            trustline: escrowData.trustline,
            milestones: newMilestones,
            isActive: true
          },
        }),
      }) as { unsignedTransaction: string };
      await signAndSendTransaction(updateRes.unsignedTransaction);

      for (let i = 0; i < newMilestones.length; i++) {
        const m = newMilestones[i];
        if (m.description.startsWith('Refund:')) {
          const approveRes = await twFetch('/escrow/multi-release/approve-milestone', {
            method: 'POST', body: JSON.stringify({ approver: platformKey, contractId: repo.escrow_contract_id, milestoneIndex: String(i) })
          }) as { unsignedTransaction: string };
          await signAndSendTransaction(approveRes.unsignedTransaction);

          const releaseRes = await twFetch('/escrow/multi-release/release-milestone-funds', {
            method: 'POST', body: JSON.stringify({ releaseSigner: platformKey, contractId: repo.escrow_contract_id, milestoneIndex: String(i) })
          }) as { unsignedTransaction: string };
          await signAndSendTransaction(releaseRes.unsignedTransaction);
          totalRefunded += m.amount;
        }
      }
    }

    // 3. Final Balance Sweep
    const balRes = await twFetch(`/helper/get-multiple-escrow-balance?addresses[]=${repo.escrow_contract_id}`, { method: 'GET' }) as Array<{ address: string, balance: number }>;
    const currentBalance = Number(balRes[0]?.balance ?? 0);

    if (currentBalance > 0) {
      console.log(`[Refund] Withdrawing extra remaining balance ${currentBalance} for repo ${repo.full_name}`);
      const wRes = await twFetch('/escrow/multi-release/withdraw-remaining-funds', {
        method: 'POST',
        body: JSON.stringify({
          contractId: repo.escrow_contract_id,
          disputeResolver: isDualWallet ? resolverPubKey : platformKey,
          distributions: [{ address: maintainer.stellar_wallet, amount: currentBalance }]
        })
      }) as { unsignedTransaction: string };
      await signAndSendTransaction(wRes.unsignedTransaction, isDualWallet ? resolverSecret : undefined);
      totalRefunded += currentBalance;
    }

    // 4. DB cleanup
    const { data: issuesToCancel } = await supabase.from('issues').select('id, github_issue_number').eq('repo_id', repoId).in('status', ['pending', 'active']);
    
    if (issuesToCancel && issuesToCancel.length > 0) {
      const issueIds = issuesToCancel.map((iss: any) => iss.id);
      await supabase.from('assignments').update({ payout_status: 'failed' }).in('issue_id', issueIds);
      await supabase.from('issues').update({ status: 'cancelled' }).in('id', issueIds);

      for (const iss of issuesToCancel) {
        await postComment(
          repo.full_name,
          iss.github_issue_number,
          `🚫 **Bounty Cancelled.**\n\nThe maintainer has withdrawn funds from the escrow. This bounty is now cancelled.\n\n[View Escrow Contract](https://viewer.trustlesswork.com/${repo.escrow_contract_id})`
        );
        cancelledCount++;
      }
    }

    await supabase.from('repos').update({ escrow_balance: 0 }).eq('id', repoId);
    json(res, { refundedAmount: totalRefunded, cancelledIssues: cancelledCount });
  } catch (err: any) {
    console.error('[Refund] Failed:', err);
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

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  if (!(await isMaintainer(githubId, repo.id))) {
    json(res, { error: 'Forbidden: Only maintainers can close the escrow' }, 403);
    return;
  }

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

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }
  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);

  if (!(await isMaintainer(githubId, body.repoId))) {
    json(res, { error: 'Forbidden: Only maintainers can perform this action' }, 403);
    return;
  }

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
  // AND filter by non-fork, public, and user-owned (personal) repos
  const { data, error } = await supabase
    .from('repos')
    .select('*')
    .or(`owner_github_id.eq.${githubId},installer_github_id.eq.${githubId}`)
    .eq('is_fork', false)
    .eq('is_private', false)
    .eq('owner_type', 'User')
    .order('created_at', { ascending: false });

  console.log(`[API] listRepos: found ${data?.length ?? 0} filtered repos for githubId=${githubId}`);

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

  const githubUserId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);

  // 1. Find internal repo ID
  const { data: repo } = await supabase
    .from('repos')
    .select('id, full_name, github_repo_id, escrow_contract_id')
    .eq('github_repo_id', body.githubRepoId)
    .single<Repo>();

  if (!repo) { json(res, { error: 'Repo not found' }, 404); return; }

  // 2. CHECK: Is this user assigned to this issue?
  const isAssigned = await isAssignedContributor(githubUserId, repo.id, body.githubIssueId);
  if (!isAssigned) {
    json(res, { error: 'Forbidden: Only the assigned contributor can connect their wallet for this issue' }, 403);
    return;
  }

  // Save wallet to contributor
  await supabase.from('contributors').upsert(
    {
      github_user_id: githubUserId,
      github_username: user.user_metadata?.user_name ?? '',
      stellar_wallet: body.wallet,
    },
    { onConflict: 'github_user_id' }
  );

  // Look up the issue

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

  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  if (!(await isMaintainer(githubId, params.repoId!))) {
    json(res, { error: 'Forbidden: Only maintainers can update reward levels' }, 403);
    return;
  }

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

  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  if (!(await isMaintainer(githubId, issue.repos.id))) {
    json(res, { error: 'Forbidden: Only the repository owner or maintainer can retry' }, 403);
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
/* DELETE /api/repos/:repoId                                            */
/* Permanently removes repo, its issues, assignments, and GitHub App   */
/* connection. Only allowed when escrow_balance is 0.                  */
/* ------------------------------------------------------------------ */
export async function deleteRepoHandler(
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>
): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);
  const { repoId } = params;

  if (!(await isMaintainer(githubId, repoId))) {
    json(res, { error: 'Forbidden: Only maintainers can delete a repository' }, 403);
    return;
  }

  const { data: repo } = await supabase.from('repos').select('*').eq('id', repoId).single<Repo>();
  if (!repo) { json(res, { error: 'Repo not found' }, 404); return; }

  // Safety guard — cannot delete while funds remain in escrow
  if (repo.escrow_balance > 0) {
    json(res, { error: 'Repo still has escrow funds. Withdraw all funds before deleting.' }, 400);
    return;
  }

  // 1. Remove GitHub App from this specific repository
  if (repo.github_installation_id) {
    try {
      const { App } = await import('@octokit/app');
      const appId = process.env.GITHUB_APP_ID;
      const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

      if (appId && privateKey) {
        let finalKey = privateKey.trim();
        if (finalKey.startsWith('"') && finalKey.endsWith('"')) finalKey = finalKey.slice(1, -1);
        if (finalKey.includes('-----BEGIN')) {
          finalKey = finalKey.replace(/\\n/g, '\n');
        } else {
          const b64Body = finalKey.replace(/\s/g, '');
          const wrapped = b64Body.match(/.{1,64}/g)?.join('\n') ?? b64Body;
          finalKey = `-----BEGIN RSA PRIVATE KEY-----\n${wrapped}\n-----END RSA PRIVATE KEY-----`;
        }

        const app = new App({ appId: Number(appId), privateKey: finalKey });

        // Remove app access from this single repository
        const [owner, repoName] = repo.full_name.split('/');
        await app.octokit.request(
          'DELETE /installations/{installation_id}/repositories/{repository_id}',
          {
            installation_id: repo.github_installation_id,
            repository_id: repo.github_repo_id,
          }
        );
        console.log(`[API] ✅ Removed GitHub App from repo: ${repo.full_name}`);
      }
    } catch (ghErr: any) {
      // Log but don't fail — still proceed with DB cleanup
      console.error(`[API] ⚠️ GitHub App removal failed (continuing): ${ghErr.message}`);
    }
  }

  // 2. Cascade-delete DB records
  // Get all issue IDs for this repo first
  const { data: issueRows } = await supabase.from('issues').select('id').eq('repo_id', repoId);
  const issueIds = (issueRows ?? []).map((r: { id: string }) => r.id);

  if (issueIds.length > 0) {
    await supabase.from('assignments').delete().in('issue_id', issueIds);
  }
  await supabase.from('issues').delete().eq('repo_id', repoId);
  const { error: deleteErr } = await supabase.from('repos').delete().eq('id', repoId);

  if (deleteErr) {
    json(res, { error: deleteErr.message }, 500);
    return;
  }

  console.log(`[API] 🗑️ Repo deleted: ${repo.full_name} (id=${repoId})`);
  json(res, { ok: true });
}

/* ------------------------------------------------------------------ */
/* util                                                                 */
/* ------------------------------------------------------------------ */

function getToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
