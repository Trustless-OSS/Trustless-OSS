import { App } from '@octokit/app';
import { supabase } from '../supabase.js';

/**
 * Generates a temporary installation access token for a specific repository.
 * If the installation ID is missing in our DB, it attempts to "auto-repair"
 * by fetching it from the GitHub API.
 */
export async function getInstallationToken(githubRepoId: number): Promise<string | null> {
  console.error(`[GitHub Auth] 🚀 Starting getInstallationToken for repo ID: ${githubRepoId}`);

  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  if (!appId || !privateKey) {
    console.error(`[GitHub Auth] ❌ Missing env: GITHUB_APP_ID=${appId ? 'present' : 'MISSING'}, GITHUB_APP_PRIVATE_KEY=${privateKey ? 'present' : 'MISSING'}`);
    return null;
  }

  const numericAppId = Number(appId);
  if (isNaN(numericAppId)) {
    console.error(`[GitHub Auth] ❌ GITHUB_APP_ID is not numeric: "${appId}"`);
    return null;
  }

  console.error(`[GitHub Auth] ℹ️  App ID: ${numericAppId}`);

  // 1. Fetch the repo from our database
  const { data: repo, error: dbError } = await supabase
    .from('repos')
    .select('github_installation_id, full_name')
    .eq('github_repo_id', githubRepoId)
    .single();

  if (dbError) {
    console.error(`[GitHub Auth] ❌ DB error for repo ID ${githubRepoId}: ${dbError.message}`);
    return null;
  }
  if (!repo) {
    console.error(`[GitHub Auth] ❌ No repo found in DB for ID: ${githubRepoId}`);
    return null;
  }

  console.error(`[GitHub Auth] ℹ️  DB row: full_name=${repo.full_name}, installation_id=${repo.github_installation_id ?? 'NULL'}`);

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

  // Log key diagnostics (safe: only header/footer, no key body)
  const keyLines = finalKey.split('\n');
  console.error(`[GitHub Auth] 🔑 Key header: "${keyLines[0]}", footer: "${keyLines[keyLines.length - 1]}", total chars: ${finalKey.length}`);

  // 3. Initialise the Octokit App (signs JWTs with the private key)
  let app: App;
  try {
    app = new App({ appId: numericAppId, privateKey: finalKey });
    console.error(`[GitHub Auth] ✅ Octokit App initialised`);
  } catch (initErr: any) {
    console.error(`[GitHub Auth] ❌ Failed to initialise Octokit App: ${initErr.message}`);
    return null;
  }

  // 4. Resolve installation ID (auto-repair if missing)
  let installationId = repo.github_installation_id ? Number(repo.github_installation_id) : null;

  if (!installationId) {
    console.error(`[GitHub Auth] 🛠️  installation_id is NULL — attempting auto-repair via GitHub API...`);

    if (!repo.full_name?.includes('/')) {
      console.error(`[GitHub Auth] ❌ Invalid full_name in DB: "${repo.full_name}"`);
      return null;
    }

    const [owner, name] = repo.full_name.split('/');

    try {
      const { data: installation } = await app.octokit.request(
        'GET /repos/{owner}/{repo}/installation',
        { owner: owner!, repo: name! }
      );

      installationId = installation.id;
      console.error(`[GitHub Auth] ✅ Auto-repair succeeded: installation ID = ${installationId}`);

      // Persist for next time
      await supabase
        .from('repos')
        .update({ github_installation_id: installationId })
        .eq('github_repo_id', githubRepoId);
    } catch (apiErr: any) {
      const status = apiErr.status ?? apiErr.response?.status ?? 'unknown';
      const ghMsg = apiErr.response?.data?.message ?? apiErr.message;
      console.error(`[GitHub Auth] ❌ Auto-repair failed (HTTP ${status}): ${ghMsg}`);
      return null;
    }
  }

  // 5. Exchange installation ID for a short-lived access token
  console.error(`[GitHub Auth] 🛰️  Requesting access token for installation ID: ${installationId}`);
  try {
    const auth = await app.octokit.request(
      'POST /app/installations/{installation_id}/access_tokens',
      { installation_id: installationId! }
    );
    console.error(`[GitHub Auth] ✅ Token generated for ${repo.full_name}`);
    return auth.data.token;
  } catch (tokenErr: any) {
    const status = tokenErr.status ?? tokenErr.response?.status ?? 'unknown';
    const ghMsg = tokenErr.response?.data?.message ?? tokenErr.message;
    console.error(`[GitHub Auth] ❌ Token exchange failed (HTTP ${status}) for ${repo.full_name}: ${ghMsg}`);
    return null;
  }
}
