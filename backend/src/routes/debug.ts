import type { IncomingMessage, ServerResponse } from 'http';
import { App } from '@octokit/app';
import { supabase } from '../lib/supabase.js';
import { json } from '../router.js';

/**
 * GET /api/debug/auth?repoId=<github_repo_id>
 *
 * Runs the full GitHub App auth flow and returns every intermediate
 * result as JSON — use this to diagnose "Failed to generate auth token" errors
 * without having to trigger a webhook.
 *
 * REMOVE this endpoint before going to production with sensitive repos.
 */
export async function debugAuthHandler(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const repoIdParam = url.searchParams.get('repoId');

  const result: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    steps: [] as string[],
    error: null as string | null,
    success: false,
  };
  const steps = result.steps as string[];

  // ── Step 1: env vars ──────────────────────────────────────────────
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

  steps.push(`GITHUB_APP_ID = ${appId ? `"${appId}"` : 'MISSING'}`);
  steps.push(`GITHUB_APP_PRIVATE_KEY = ${privateKey ? `present (${privateKey.length} chars)` : 'MISSING'}`);

  if (!appId || !privateKey) {
    result.error = 'Missing env vars';
    return json(res, result, 500);
  }

  const numericAppId = Number(appId);
  steps.push(`App ID parsed: ${numericAppId} (valid: ${!isNaN(numericAppId)})`);
  if (isNaN(numericAppId)) {
    result.error = 'GITHUB_APP_ID is not numeric';
    return json(res, result, 500);
  }

  // ── Step 2: key parsing ───────────────────────────────────────────
  let normalizedKey = privateKey.trim();
  if (normalizedKey.startsWith('"') && normalizedKey.endsWith('"')) {
    normalizedKey = normalizedKey.slice(1, -1);
    steps.push('Key: stripped surrounding quotes');
  }

  let finalKey: string;
  if (normalizedKey.includes('-----BEGIN')) {
    finalKey = normalizedKey.replace(/\\n/g, '\n');
    steps.push(`Key: PEM detected. After \\n unescape: ${finalKey.length} chars`);
  } else {
    // Raw base64 PEM body — re-wrap with RSA headers instead of decoding to binary
    const b64Body = normalizedKey.replace(/\s/g, '');
    const wrapped = b64Body.match(/.{1,64}/g)?.join('\n') ?? b64Body;
    finalKey = `-----BEGIN RSA PRIVATE KEY-----\n${wrapped}\n-----END RSA PRIVATE KEY-----`;
    steps.push(`Key: base64 body detected. Wrapped as RSA PEM: ${finalKey.length} chars`);
  }

  const keyLines = finalKey.split('\n');
  steps.push(`Key header: "${keyLines[0]}"`);
  steps.push(`Key footer: "${keyLines[keyLines.length - 1]}"`);
  steps.push(`Key line count: ${keyLines.length}`);

  // ── Step 3: Octokit App init ──────────────────────────────────────
  let app: App;
  try {
    app = new App({ appId: numericAppId, privateKey: finalKey });
    steps.push('Octokit App initialised OK');
  } catch (e: any) {
    result.error = `Octokit App init failed: ${e.message}`;
    return json(res, result, 500);
  }

  // ── Step 4: DB lookup ─────────────────────────────────────────────
  const githubRepoId = repoIdParam ? Number(repoIdParam) : 1234352351; // default to ryzen-xp/Test
  steps.push(`Looking up repo by github_repo_id = ${githubRepoId}`);

  const { data: repo, error: dbErr } = await supabase
    .from('repos')
    .select('github_installation_id, full_name, github_repo_id')
    .eq('github_repo_id', githubRepoId)
    .single();

  if (dbErr || !repo) {
    result.error = `DB lookup failed: ${dbErr?.message ?? 'no row'}`;
    return json(res, result, 500);
  }
  steps.push(`DB repo: full_name="${repo.full_name}", installation_id=${repo.github_installation_id ?? 'NULL'}`);

  // ── Step 5: resolve installation ID ───────────────────────────────
  let installationId = repo.github_installation_id ? Number(repo.github_installation_id) : null;

  if (!installationId) {
    steps.push('installation_id is NULL — trying auto-repair via GitHub API...');
    const [owner, name] = repo.full_name.split('/');
    try {
      const { data: inst } = await app.octokit.request(
        'GET /repos/{owner}/{repo}/installation',
        { owner: owner!, repo: name! }
      );
      installationId = inst.id;
      steps.push(`Auto-repair succeeded: installation_id = ${installationId}`);
    } catch (e: any) {
      const status = e.status ?? e.response?.status ?? '?';
      const msg = e.response?.data?.message ?? e.message;
      result.error = `Auto-repair failed (HTTP ${status}): ${msg}`;
      result.steps = steps;
      return json(res, result, 500);
    }
  }

  // ── Step 6: token exchange ────────────────────────────────────────
  steps.push(`Requesting token for installation_id = ${installationId}`);
  try {
    const auth = await app.octokit.request(
      'POST /app/installations/{installation_id}/access_tokens',
      { installation_id: installationId! }
    );
    steps.push(`Token generated! Expires: ${auth.data.expires_at}`);
    result.success = true;
    result.tokenPreview = auth.data.token.substring(0, 10) + '…';
  } catch (e: any) {
    const status = e.status ?? e.response?.status ?? '?';
    const msg = e.response?.data?.message ?? e.message;
    result.error = `Token exchange failed (HTTP ${status}): ${msg}`;
    result.steps = steps;
    return json(res, result, 500);
  }

  result.steps = steps;
  return json(res, result);
}
