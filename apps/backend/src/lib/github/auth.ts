import { App } from '@octokit/app';
import { supabase } from '../supabase.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'github-auth' });

/**
 * Generates a temporary installation access token for a specific repository.
 * If the installation ID is missing in our DB, it attempts to "auto-repair"
 * by fetching it from the GitHub API.
 */
export async function getInstallationToken(githubRepoId: number): Promise<string | null> {
  log.debug({ githubRepoId }, 'getInstallationToken started');

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    log.error(
      { hasAppId: !!appId, hasPrivateKey: !!privateKey },
      'missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY'
    );
    return null;
  }

  const numericAppId = Number(appId);
  if (isNaN(numericAppId)) {
    log.error({ appId }, 'GITHUB_APP_ID is not numeric');
    return null;
  }

  // 1. Fetch the repo from our database
  const { data: repo, error: dbError } = await supabase
    .from('repos')
    .select('github_installation_id, full_name')
    .eq('github_repo_id', githubRepoId)
    .single();

  if (dbError) {
    log.error({ err: dbError, githubRepoId }, 'DB error fetching repo for installation token');
    return null;
  }
  if (!repo) {
    log.error({ githubRepoId }, 'no repo found in DB for installation token');
    return null;
  }

  // 2. Parse private key — handle all common Vercel storage formats:
  //    a) PEM with literal \n  (most common in Vercel env vars)
  //    b) PEM already with real newlines
  //    c) Base64-encoded PEM
  let normalizedKey = privateKey.trim();

  // Strip surrounding quotes if any (some Vercel configs add them)
  if (normalizedKey.startsWith('"') && normalizedKey.endsWith('"')) {
    normalizedKey = normalizedKey.slice(1, -1);
  }

  let finalKey: string;
  if (normalizedKey.includes('-----BEGIN')) {
    // Already a full PEM string — unescape any literal \n sequences
    finalKey = normalizedKey.replace(/\\n/g, '\n');
  } else {
    // The env var holds the raw base64 body of the PEM (no headers/footers).
    // DO NOT base64-decode it — the decoded bytes would be raw DER binary
    // which JWT libraries reject. Instead, re-wrap it as a proper RSA PEM.
    const b64Body = normalizedKey.replace(/\s/g, ''); // strip any stray whitespace
    const wrapped = b64Body.match(/.{1,64}/g)?.join('\n') ?? b64Body;
    finalKey = `-----BEGIN RSA PRIVATE KEY-----\n${wrapped}\n-----END RSA PRIVATE KEY-----`;
  }

  // 3. Initialise the Octokit App (signs JWTs with the private key)
  let app: App;
  try {
    app = new App({ appId: numericAppId, privateKey: finalKey });
  } catch (initErr: any) {
    log.error({ err: initErr }, 'failed to initialise Octokit App');
    return null;
  }

  // 4. Resolve installation ID (auto-repair if missing)
  let installationId = repo.github_installation_id ? Number(repo.github_installation_id) : null;

  if (!installationId) {
    log.warn(
      { repo: repo.full_name },
      'installation_id is NULL — attempting auto-repair via GitHub API'
    );

    if (!repo.full_name?.includes('/')) {
      log.error({ fullName: repo.full_name }, 'invalid full_name in DB');
      return null;
    }

    const [owner, name] = repo.full_name.split('/');

    try {
      const { data: installation } = await app.octokit.request(
        'GET /repos/{owner}/{repo}/installation',
        { owner: owner!, repo: name! }
      );

      installationId = installation.id;
      log.info({ repo: repo.full_name, installationId }, 'auto-repair succeeded');

      // Persist for next time
      await supabase
        .from('repos')
        .update({ github_installation_id: installationId })
        .eq('github_repo_id', githubRepoId);
    } catch (apiErr: any) {
      const status = apiErr.status ?? apiErr.response?.status ?? 'unknown';
      const ghMsg = apiErr.response?.data?.message ?? apiErr.message;
      log.error({ err: apiErr, status, repo: repo.full_name }, `auto-repair failed: ${ghMsg}`);
      return null;
    }
  }

  // 5. Exchange installation ID for a short-lived access token
  try {
    const auth = await app.octokit.request(
      'POST /app/installations/{installation_id}/access_tokens',
      { installation_id: installationId }
    );
    log.debug({ repo: repo.full_name }, 'installation token generated');
    return auth.data.token;
  } catch (tokenErr: any) {
    const status = tokenErr.status ?? tokenErr.response?.status ?? 'unknown';
    const ghMsg = tokenErr.response?.data?.message ?? tokenErr.message;
    log.error({ err: tokenErr, status, repo: repo.full_name }, `token exchange failed: ${ghMsg}`);
    return null;
  }
}
