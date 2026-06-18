import { supabase } from '../supabase.js';
import { getInstallationToken } from './auth.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'github-comments' });

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
    log.debug({ repo: fullName, issue: issueNumber }, 'skipping duplicate comment');
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
      log.error({ repo: fullName }, 'cannot post comment — repository not found in database');
      return;
    }

    // 2. Get a fresh Installation Token
    const repoId = repo.github_repo_id;
    log.debug({ repo: fullName, repoId }, 'requesting installation token');
    const token = await getInstallationToken(Number(repoId));
    if (!token) {
      log.error({ repo: fullName }, 'cannot post comment — failed to generate auth token');
      return;
    }

    // 3. Post the comment
    const res = await fetch(
      `https://api.github.com/repos/${fullName}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      log.error(
        { repo: fullName, issue: issueNumber, status: res.status, detail: errText },
        'failed to post comment'
      );
      return;
    }

    log.info({ repo: fullName, issue: issueNumber }, 'comment posted');
  } catch (err) {
    log.error({ err, repo: fullName, issue: issueNumber }, 'exception posting comment');
  }
}
