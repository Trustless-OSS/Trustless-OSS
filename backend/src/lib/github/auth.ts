import { App } from '@octokit/app';
import { supabase } from '../supabase.js';

/**
 * Generates a temporary installation access token for a specific repository.
 * This bypasses the need for a personal GITHUB_BOT_TOKEN.
 */
export async function getInstallationToken(githubRepoId: number): Promise<string | null> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    console.error('[GitHub Auth] ❌ GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is missing in .env');
    return null;
  }

  // 1. Fetch the installation ID for this repo from our database
  const { data: repo } = await supabase
    .from('repos')
    .select('github_installation_id')
    .eq('github_repo_id', githubRepoId)
    .single();

  if (!repo || !repo.github_installation_id) {
    console.error(`[GitHub Auth] ❌ No installation ID found for repo ID: ${githubRepoId}. Make sure you connected the repo through the DApp.`);
    return null;
  }

  try {
    // 2. Initialize the GitHub App
    const app = new App({
      appId,
      privateKey: privateKey.includes('-----BEGIN PRIVATE KEY-----') 
        ? privateKey 
        : Buffer.from(privateKey, 'base64').toString('utf-8'),
    });

    // 3. Request a fresh installation token
    const installationId = Number(repo.github_installation_id);
    const auth = await app.octokit.request('POST /app/installations/{installation_id}/access_tokens', {
      installation_id: installationId,
    });

    return auth.data.token;
  } catch (err: any) {
    console.error(`[GitHub Auth] ❌ Failed to generate token for installation ${repo.github_installation_id}:`, err.message);
    return null;
  }
}
