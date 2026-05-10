import type { IncomingMessage, ServerResponse } from 'http';
import { readBody, json } from '../router.js';
import { supabase } from '../lib/supabase.js';
import { createRepoEscrow } from '../lib/trustless-work/escrow.js';
import { pushMilestoneOnChain } from '../lib/trustless-work/milestone.js';
import type { Repo, Issue, Contributor } from '../types/index.js';

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
  };

  const { data, error } = await supabase
    .from('repos')
    .upsert(
      {
        github_repo_id: body.githubRepoId,
        full_name: body.fullName,
        owner_github_id: body.ownerGithubId,
        owner_username: body.ownerUsername,
      },
      { onConflict: 'github_repo_id' }
    )
    .select()
    .single<Repo>();

  if (error) { json(res, { error: error.message }, 400); return; }
  json(res, { repo: data });
}

/* ------------------------------------------------------------------ */
/* POST /api/escrow/create                                             */
/* Body: { repoId, maintainerWallet }                                  */
/* ------------------------------------------------------------------ */
export async function createEscrowHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const token = getToken(req);
  if (!token) { json(res, { error: 'Unauthorized' }, 401); return; }
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) { json(res, { error: 'Unauthorized' }, 401); return; }

  const body = JSON.parse((await readBody(req)).toString()) as {
    repoId: string;
    maintainerWallet: string;
  };

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('id', body.repoId)
    .single<Repo>();

  if (!repo) { json(res, { error: 'Repo not found' }, 404); return; }

  const result = await createRepoEscrow({
    maintainerWallet: body.maintainerWallet,
    repoName: repo.full_name,
  });

  await supabase
    .from('repos')
    .update({ escrow_contract_id: result.contractId })
    .eq('id', repo.id);

  json(res, { contractId: result.contractId });
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

  const githubId = Number(user.user_metadata?.provider_id ?? user.user_metadata?.sub);

  const { data, error } = await supabase
    .from('repos')
    .select('*')
    .eq('owner_github_id', githubId)
    .order('created_at', { ascending: false });

  if (error) { json(res, { error: error.message }, 400); return; }
  json(res, { repos: data });
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

  if (!issue || issue.status !== 'pending') {
    json(res, { error: 'Issue not in pending state' }, 400);
    return;
  }

  await pushMilestoneOnChain(repo, issue, body.wallet);
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
/* GET /api/health                                                      */
/* ------------------------------------------------------------------ */
export async function healthHandler(_req: IncomingMessage, res: ServerResponse): Promise<void> {
  json(res, { status: 'ok', ts: new Date().toISOString() });
}

/* ------------------------------------------------------------------ */
/* util                                                                 */
/* ------------------------------------------------------------------ */

function getToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
