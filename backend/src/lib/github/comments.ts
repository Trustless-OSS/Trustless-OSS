export async function postComment(
  fullName: string,
  issueNumber: number,
  body: string
): Promise<void> {
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
