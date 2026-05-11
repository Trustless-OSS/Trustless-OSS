import { supabase } from '../supabase.js';
import { getInstallationToken } from './auth.js';

const commentCache = new Map<string, number>();
const CACHE_TTL = 10000; // 10 seconds

export async function postComment(
  fullName: string,
  issueNumber: number,
  body: string
): Promise<void> {
  const cacheKey = `${fullName}#${issueNumber}:${body.substring(0, 50)}`;
  const now = Date.now();
  const lastSent = commentCache.get(cacheKey);

  if (lastSent && now - lastSent < CACHE_TTL) {
    console.log(`[GitHub] Skipping duplicate comment on ${fullName}#${issueNumber}`);
    return;
  }
  
  commentCache.set(cacheKey, now);

  try {
    // 1. Find the GitHub Repo ID from the full name
    const { data: repo } = await supabase
      .from('repos')
      .select('github_repo_id')
      .eq('full_name', fullName)
      .single();

    if (!repo) {
      console.error(`[GitHub] ❌ Cannot post comment. Repository ${fullName} not found in database.`);
      return;
    }

    // 2. Get a fresh Installation Token
    const repoId = repo.github_repo_id;
    console.error(`[GitHub] 🔑 Requesting installation token for ${fullName} (DB ID: ${repoId}, Type: ${typeof repoId})`);
    const token = await getInstallationToken(Number(repoId));
    if (!token) {
      console.error(`[GitHub] ❌ Cannot post comment. Failed to generate auth token for ${fullName}`);
      return;
    }

    // 3. Post the comment
    const res = await fetch(`https://api.github.com/repos/${fullName}/issues/${issueNumber}/comments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[GitHub] Failed to post comment on ${fullName}#${issueNumber}: ${res.status} ${err}`);
      return;
    }

    console.log(`[GitHub] ✅ Posted comment on ${fullName}#${issueNumber} using App Auth`);
  } catch (err) {
    console.error(`[GitHub] ❌ Failed to post comment on ${fullName}#${issueNumber}:`, err);
  }
}
