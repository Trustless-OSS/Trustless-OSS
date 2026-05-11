import { App } from '@octokit/app';
import { supabase } from '../supabase.js';

/**
 * Generates a temporary installation access token for a specific repository.
 * If the installation ID is missing in our DB, it attempts to "auto-repair" 
 * by fetching it from the GitHub API.
 */
export async function getInstallationToken(githubRepoId: number): Promise<string | null> {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    console.error('[GitHub Auth] ❌ GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY is missing');
    return null;
  }

  // 1. Fetch the repo from our database
  const { data: repo } = await supabase
    .from('repos')
    .select('github_installation_id, full_name')
    .eq('github_repo_id', githubRepoId)
    .single();

  if (!repo) return null;

  try {
    const app = new App({
      appId,
      privateKey: privateKey.includes('-----BEGIN PRIVATE KEY-----') 
        ? privateKey 
        : Buffer.from(privateKey, 'base64').toString('utf-8'),
    });

    let installationId = repo.github_installation_id ? Number(repo.github_installation_id) : null;

    // 2. AUTO-REPAIR: If ID is missing, ask GitHub for it
    if (!installationId) {
      console.log(`[GitHub Auth] 🛠️ Attempting auto-repair for ${repo.full_name}...`);
      const [owner, name] = repo.full_name.split('/');
      
      try {
        const { data: installation } = await app.octokit.request('GET /repos/{owner}/{repo}/installation', {
          owner: owner!,
          repo: name!,
        });
        
        installationId = installation.id;
        
        // Save it for next time
        await supabase
          .from('repos')
          .update({ github_installation_id: installationId })
          .eq('github_repo_id', githubRepoId);
          
        console.log(`[GitHub Auth] ✅ Auto-repaired! Saved installation ID ${installationId} for ${repo.full_name}`);
      } catch (apiErr: any) {
        console.error(`[GitHub Auth] ❌ Auto-repair failed for ${repo.full_name}: ${apiErr.message}`);
        return null;
      }
    }

    // 3. Request a fresh installation token
    const auth = await app.octokit.request('POST /app/installations/{installation_id}/access_tokens', {
      installation_id: installationId!,
    });

    return auth.data.token;
  } catch (err: any) {
    console.error(`[GitHub Auth] ❌ Failed to generate token for ${repo.full_name}:`, err.message);
    return null;
  }
}
