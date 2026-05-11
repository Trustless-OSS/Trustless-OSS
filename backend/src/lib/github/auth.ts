import { App } from '@octokit/app';
import { supabase } from '../supabase.js';

/**
 * Generates a temporary installation access token for a specific repository.
 * If the installation ID is missing in our DB, it attempts to "auto-repair" 
 * by fetching it from the GitHub API.
 */
export async function getInstallationToken(githubRepoId: number): Promise<string | null> {
  console.error(`[GitHub Auth] 🚀 Starting getInstallationToken for ID: ${githubRepoId} (Type: ${typeof githubRepoId})`);
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    console.error(`[GitHub Auth] ❌ GITHUB_APP_ID (${appId ? 'present' : 'MISSING'}) or GITHUB_APP_PRIVATE_KEY (${privateKey ? 'present' : 'MISSING'}) is missing`);
    return null;
  }

  const numericAppId = Number(appId);
  if (isNaN(numericAppId)) {
    console.error(`[GitHub Auth] ❌ GITHUB_APP_ID is not a valid number: "${appId}"`);
    return null;
  }

  // 1. Fetch the repo from our database
  console.error(`[GitHub Auth] 🔍 Fetching installation ID for repo ID: ${githubRepoId}`);
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
    console.error(`[GitHub Auth] 🔑 Creating Octokit App for ${repo.full_name}...`);
    
    // Robust private key parsing
    let normalizedKey = privateKey.trim();
    if (normalizedKey.startsWith('"') && normalizedKey.endsWith('"')) {
      normalizedKey = normalizedKey.substring(1, normalizedKey.length - 1);
    }

    const finalKey = normalizedKey.includes('-----BEGIN PRIVATE KEY-----')
      ? normalizedKey.replace(/\\n/g, '\n')
      : Buffer.from(normalizedKey, 'base64').toString('utf-8');

    console.error(`[GitHub Auth] 🔑 Key length: ${finalKey.length}, Header: ${finalKey.substring(0, 25)}...`);

    const app = new App({
      appId: numericAppId,
      privateKey: finalKey,
    });    
    console.error(`[GitHub Auth] ✅ Octokit App initialized for ${repo.full_name}`);

    let installationId = repo.github_installation_id ? Number(repo.github_installation_id) : null;

    // 2. AUTO-REPAIR: If ID is missing, ask GitHub for it
    if (!installationId) {
      console.error(`[GitHub Auth] 🛠️ Attempting auto-repair for ${repo.full_name}...`);
      
      if (!repo.full_name || !repo.full_name.includes('/')) {
        console.error(`[GitHub Auth] ❌ Invalid full_name in DB: "${repo.full_name}"`);
        return null;
      }

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
          
        console.error(`[GitHub Auth] ✅ Auto-repaired! Saved installation ID ${installationId} for ${repo.full_name}`);
      } catch (apiErr: any) {
        console.error(`[GitHub Auth] ❌ Auto-repair failed for ${repo.full_name}: ${apiErr.message}`);
        return null;
      }
    }

    // 3. Request a fresh installation token
    console.error(`[GitHub Auth] 🛰️ Requesting access token for installation ${installationId}...`);
    const auth = await app.octokit.request('POST /app/installations/{installation_id}/access_tokens', {
      installation_id: installationId!,
    });

    console.error(`[GitHub Auth] ✅ Token generated successfully for ${repo.full_name}`);
    return auth.data.token;
  } catch (err: any) {
    console.error(`[GitHub Auth] ❌ Failed to generate token for ${repo.full_name}:`, err.message);
    return null;
  }
}
