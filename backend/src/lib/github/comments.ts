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

  const token = process.env.GITHUB_BOT_TOKEN;
  if (!token) {
    console.error(`[GitHub] Cannot post comment. GITHUB_BOT_TOKEN is missing in .env`);
    return;
  }

  try {
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

    console.log(`[GitHub] Posted comment on ${fullName}#${issueNumber}`);
  } catch (err) {
    console.error(`[GitHub] Failed to post comment on ${fullName}#${issueNumber}:`, err);
  }
}
