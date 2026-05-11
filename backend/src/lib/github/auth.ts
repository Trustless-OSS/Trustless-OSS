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
    console.error(`[GitHub Auth] ❌ GITHUB_APP_ID (${appId ? 'present' : 'MISSING'}) or GITHUB_APP_PRIVATE_KEY (${privateKey ? 'present' : 'MISSING'}) is missing`);
    return null;
  }

  // 1. Fetch the repo from our database
  console.log(`[GitHub Auth] 🔍 Fetching installation ID for repo ID: ${githubRepoId}`);
  const { data: repo, error: dbError } = await supabase
    .from('repos')
    .select('github_installation_id, full_name')
    .eq('github_repo_id', githubRepoId)
    .single();

  if (dbError) {
    console.error(`[GitHub Auth] ❌ Database error for repo ID ${githubRepoId}:`, dbError.message);
    return null;
  }

  if (!repo) {
    console.error(`[GitHub Auth] ❌ No repo found in DB for ID: ${githubRepoId}`);
    return null;
  }

  try {
    console.log(`[GitHub Auth] 🔑 Creating Octokit App for ${repo.full_name}...`);
    
    // Robust private key parsing
    let normalizedKey = privateKey.trim();
    if (normalizedKey.startsWith('"') && normalizedKey.endsWith('"')) {
      normalizedKey = normalizedKey.substring(1, normalizedKey.length - 1);
    }

    const finalKey = normalizedKey.includes('-----BEGIN PRIVATE KEY-----')
      ? normalizedKey.replace(/\\n/g, '\n')
      : Buffer.from(normalizedKey, 'base64').toString('utf-8');

    const app = new App({
      appId,
      privateKey: finalKey,
    });    
    console.log(`[GitHub Auth] ✅ Octokit App initialized for ${repo.full_name}`);

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
    console.log(`[GitHub Auth] 🛰️ Requesting access token for installation ${installationId}...`);
    const auth = await app.octokit.request('POST /app/installations/{installation_id}/access_tokens', {
      installation_id: installationId!,
    });

    console.log(`[GitHub Auth] ✅ Token generated successfully for ${repo.full_name}`);
    return auth.data.token;
  } catch (err: any) {
    console.error(`[GitHub Auth] ❌ Failed to generate token for ${repo.full_name}:`, err.message);
    return null;
  }
}
