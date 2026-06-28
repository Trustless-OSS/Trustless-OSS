import { App } from '@octokit/app';
import { cache, CACHE_KEYS, CACHE_TTLS } from '../cache.js';
import { logger } from '../logger.js';
import { getRepoByGithubId } from './repos.js';

const log = logger.child({ module: 'github-auth' });

/**
 * Generates a temporary installation access token for a specific repository.
 * If the installation ID is missing in our DB, it attempts to "auto-repair"
 * by fetching it from the GitHub API.
 */
export async function getInstallationToken(githubRepoId: number): Promise<string | null> {
  log.debug({ githubRepoId }, 'getInstallationToken started');

  const tokenCacheKey = CACHE_KEYS.ghToken(githubRepoId);
  const cachedToken = await cache.get<string>(tokenCacheKey);
  if (cachedToken) {
    log.debug({ githubRepoId }, 'installation token cache hit');
    return cachedToken;
  }

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

  const repo = await getRepoByGithubId(githubRepoId);
  if (!repo) {
    log.error({ githubRepoId }, 'no repo found in DB for installation token');
    return null;
  }

  let normalizedKey = privateKey.trim();

  if (normalizedKey.startsWith('"') && normalizedKey.endsWith('"')) {
    normalizedKey = normalizedKey.slice(1, -1);
  }

  let finalKey: string;
  if (normalizedKey.includes('-----BEGIN')) {
    finalKey = normalizedKey.replace(/\\n/g, '\n');
  } else {
    const b64Body = normalizedKey.replace(/\s/g, '');
    const wrapped = b64Body.match(/.{1,64}/g)?.join('\n') ?? b64Body;
    finalKey = `-----BEGIN RSA PRIVATE KEY-----\n${wrapped}\n-----END RSA PRIVATE KEY-----`;
  }

  let app: App;
  try {
    app = new App({ appId: numericAppId, privateKey: finalKey });
  } catch (initErr: unknown) {
    log.error({ err: initErr }, 'failed to initialise Octokit App');
    return null;
  }

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

      const { supabase } = await import('../supabase.js');
      await supabase
        .from('repos')
        .update({ github_installation_id: installationId })
        .eq('github_repo_id', githubRepoId);

      const { invalidateRepoCache } = await import('./repos.js');
      await invalidateRepoCache(repo.id, githubRepoId);
    } catch (apiErr: unknown) {
      const err = apiErr as {
        status?: number;
        response?: { status?: number; data?: { message?: string } };
        message?: string;
      };
      const status = err.status ?? err.response?.status ?? 'unknown';
      const ghMsg = err.response?.data?.message ?? err.message;
      log.error({ err: apiErr, status, repo: repo.full_name }, `auto-repair failed: ${ghMsg}`);
      return null;
    }
  }

  try {
    const auth = await app.octokit.request(
      'POST /app/installations/{installation_id}/access_tokens',
      { installation_id: installationId }
    );
    const token = auth.data.token;
    log.debug({ repo: repo.full_name }, 'installation token generated');
    await cache.set(tokenCacheKey, token, CACHE_TTLS.GH_TOKEN);
    return token;
  } catch (tokenErr: unknown) {
    const err = tokenErr as {
      status?: number;
      response?: { status?: number; data?: { message?: string } };
      message?: string;
    };
    const status = err.status ?? err.response?.status ?? 'unknown';
    const ghMsg = err.response?.data?.message ?? err.message;
    log.error({ err: tokenErr, status, repo: repo.full_name }, `token exchange failed: ${ghMsg}`);
    return null;
  }
}
