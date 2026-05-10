import { App } from '@octokit/app';

let _app: App | null = null;

function getApp(): App {
  if (!_app) {
    const rawKey = process.env.GITHUB_APP_PRIVATE_KEY!;
    const privateKey = rawKey.includes('BEGIN')
      ? rawKey                                              // already PEM
      : Buffer.from(rawKey, 'base64').toString('utf-8');   // base64 encoded

    _app = new App({
      appId: process.env.GITHUB_APP_ID!,
      privateKey,
      webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET! },
    });
  }
  return _app;
}

// Minimal REST surface we use — typed explicitly to avoid Octokit generics complexity
interface RestOctokit {
  rest: {
    repos: {
      get(params: { owner: string; repo: string }): Promise<unknown>;
    };
    issues: {
      createComment(params: {
        owner: string;
        repo: string;
        issue_number: number;
        body: string;
      }): Promise<unknown>;
    };
  };
}

async function findInstallationOctokit(fullName: string): Promise<RestOctokit> {
  const app = getApp();
  const [owner, repo] = fullName.split('/');

  for await (const { installation } of app.eachInstallation.iterator()) {
    // Cast to our minimal interface — @octokit/app returns a full Octokit which does have .rest
    const octokit = (await app.getInstallationOctokit(installation.id)) as unknown as RestOctokit;
    try {
      await octokit.rest.repos.get({ owner: owner!, repo: repo! });
      return octokit;
    } catch {
      // Not this installation
    }
  }

  throw new Error(`No GitHub App installation found for ${fullName}`);
}

export async function postComment(
  fullName: string,
  issueNumber: number,
  body: string
): Promise<void> {
  const [owner, repo] = fullName.split('/');

  try {
    const octokit = await findInstallationOctokit(fullName);
    await octokit.rest.issues.createComment({
      owner: owner!,
      repo: repo!,
      issue_number: issueNumber,
      body,
    });
    console.log(`[GitHub] Posted comment on ${fullName}#${issueNumber}`);
  } catch (err) {
    console.error(`[GitHub] Failed to post comment on ${fullName}#${issueNumber}:`, err);
  }
}
