import { supabase } from '../supabase.js';
import { parseLabels, getRewardAmount } from './labels.js';
import { postComment } from './comments.js';
import { pushMilestoneOnChain, releaseEscrowMilestone } from '../trustless-work/milestone.js';
import type { Repo, Contributor, Issue, Assignment } from '../../types/index.js';

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

function extractIssueNumber(body: string | null): number | null {
  if (!body) return null;
  const match = body.match(/(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)\s+#(\d+)/i);
  return match ? parseInt(match[1]!, 10) : null;
}

/* ------------------------------------------------------------------ */
/* issues.labeled                                                       */
/* ------------------------------------------------------------------ */

export async function handleIssueLabeled(payload: Record<string, unknown>): Promise<void> {
  const repository = payload.repository as { id: number; full_name: string };
  const issue = payload.issue as {
    id: number;
    number: number;
    title: string;
    labels: { name: string }[];
  };

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('github_repo_id', repository.id)
    .single<Repo>();

  if (!repo || !repo.escrow_contract_id) return;

  const parsed = parseLabels(issue.labels);
  if (!parsed.isRewarded || !parsed.difficulty) return;

  // Idempotency — skip if already created
  const { data: existing } = await supabase
    .from('issues')
    .select('id')
    .eq('repo_id', repo.id)
    .eq('github_issue_id', issue.id)
    .single();

  if (existing) return;

  const rewardAmount = getRewardAmount(parsed.difficulty, parsed.bonusAmount, repo);

  // Solvency check
  if (repo.escrow_balance < rewardAmount) {
    await postComment(
      repository.full_name,
      issue.number,
      `⚠️ Insufficient escrow balance (**${repo.escrow_balance} USDC**). Need **${rewardAmount} USDC** to reward this issue.\n\n[Top up your escrow →](${process.env.APP_URL}/dashboard)`
    );
    return;
  }

  // Create milestone record in DB
  await supabase.from('issues').insert({
    repo_id: repo.id,
    github_issue_id: issue.id,
    github_issue_number: issue.number,
    title: issue.title,
    reward_amount: rewardAmount,
    difficulty_label: parsed.difficulty,
    bonus_amount: parsed.bonusAmount,
    status: 'pending',
  });

  // Reserve balance
  await supabase
    .from('repos')
    .update({ escrow_balance: repo.escrow_balance - rewardAmount })
    .eq('id', repo.id);

  await postComment(
    repository.full_name,
    issue.number,
    `🎯 Bounty of **${rewardAmount} USDC** created for this issue! Assign a contributor to get started.`
  );

  console.log(`[Webhook] Created bounty issue: ${repository.full_name}#${issue.number} → ${rewardAmount} USDC`);
}

/* ------------------------------------------------------------------ */
/* issues.assigned                                                      */
/* ------------------------------------------------------------------ */

export async function handleIssueAssigned(payload: Record<string, unknown>): Promise<void> {
  const repository = payload.repository as { id: number; full_name: string };
  const issue = payload.issue as { id: number; number: number };
  const assignee = payload.assignee as { id: number; login: string };

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('github_repo_id', repository.id)
    .single<Repo>();

  if (!repo) return;

  const { data: issueRecord } = await supabase
    .from('issues')
    .select('*')
    .eq('repo_id', repo.id)
    .eq('github_issue_id', issue.id)
    .single<Issue>();

  if (!issueRecord || issueRecord.status !== 'pending') return;

  // Find or create contributor
  let { data: contributor } = await supabase
    .from('contributors')
    .select('*')
    .eq('github_user_id', assignee.id)
    .single<Contributor>();

  if (!contributor) {
    const { data: newContributor } = await supabase
      .from('contributors')
      .insert({ github_user_id: assignee.id, github_username: assignee.login })
      .select()
      .single<Contributor>();
    contributor = newContributor;
  }

  if (!contributor) return;

  // Upsert assignment
  await supabase.from('assignments').upsert(
    { issue_id: issueRecord.id, contributor_id: contributor.id },
    { onConflict: 'issue_id' }
  );

  if (contributor.stellar_wallet) {
    // Push milestone on-chain immediately
    await pushMilestoneOnChain(repo, issueRecord, contributor.stellar_wallet);
    await postComment(
      repository.full_name,
      issue.number,
      `✅ Bounty of **${issueRecord.reward_amount} USDC** locked on-chain for @${assignee.login}! Merge the PR to release funds.`
    );
  } else {
    // Ask for wallet via comment
    const connectUrl = `${process.env.APP_URL}/connect?issue=${issue.id}&repo=${repository.id}`;
    await postComment(
      repository.full_name,
      issue.number,
      `👋 Hey @${assignee.login}! You've been assigned a bounty of **${issueRecord.reward_amount} USDC**.\n\nConnect your Stellar wallet to claim it: [**Click here →**](${connectUrl})`
    );
  }
}

/* ------------------------------------------------------------------ */
/* issues.unassigned                                                    */
/* ------------------------------------------------------------------ */

export async function handleIssueUnassigned(payload: Record<string, unknown>): Promise<void> {
  const repository = payload.repository as { id: number };
  const issue = payload.issue as { id: number; number: number };

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('github_repo_id', repository.id)
    .single<Repo>();

  if (!repo) return;

  const { data: issueRecord } = await supabase
    .from('issues')
    .select('*')
    .eq('repo_id', repo.id)
    .eq('github_issue_id', issue.id)
    .single<Issue>();

  if (!issueRecord || issueRecord.status === 'completed' || issueRecord.status === 'cancelled') return;

  // Cancel in DB + restore balance
  await supabase.from('issues').update({ status: 'cancelled' }).eq('id', issueRecord.id);
  await supabase
    .from('repos')
    .update({ escrow_balance: repo.escrow_balance + issueRecord.reward_amount })
    .eq('id', repo.id);

  console.log(`[Webhook] Cancelled milestone for issue #${issue.number}`);
}

/* ------------------------------------------------------------------ */
/* pull_request.closed (merged)                                         */
/* ------------------------------------------------------------------ */

export async function handlePRMerged(payload: Record<string, unknown>): Promise<void> {
  const repository = payload.repository as { id: number; full_name: string };
  const pr = payload.pull_request as { number: number; body: string | null };

  const issueNumber = extractIssueNumber(pr.body);
  if (!issueNumber) {
    console.log('[Webhook] PR merged but no linked issue found in body');
    return;
  }

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('github_repo_id', repository.id)
    .single<Repo>();

  if (!repo) return;

  const { data: issueRecord } = await supabase
    .from('issues')
    .select('*')
    .eq('repo_id', repo.id)
    .eq('github_issue_number', issueNumber)
    .single<Issue>();

  if (!issueRecord || issueRecord.status !== 'active') return;

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*, contributors(*)')
    .eq('issue_id', issueRecord.id)
    .single<Assignment>();

  if (!assignment) return;

  // Record the PR merge
  await supabase
    .from('assignments')
    .update({ pr_number: pr.number, pr_merged_at: new Date().toISOString() })
    .eq('id', assignment.id);

  // Approve + release via Trustless Work
  const released = await releaseEscrowMilestone(repo, issueRecord);

  if (released) {
    await supabase.from('assignments').update({ payout_status: 'released' }).eq('id', assignment.id);
    await supabase.from('issues').update({ status: 'completed' }).eq('id', issueRecord.id);

    const username = assignment.contributors?.github_username ?? 'contributor';
    await postComment(
      repository.full_name,
      issueNumber,
      `🎉 Bounty of **${issueRecord.reward_amount} USDC** released to @${username}! Thanks for your contribution! 🚀`
    );
  } else {
    await supabase.from('assignments').update({ payout_status: 'failed' }).eq('id', assignment.id);
    await postComment(
      repository.full_name,
      issueNumber,
      `⚠️ Bounty release failed. Please contact the platform admin.`
    );
  }
}

/* ------------------------------------------------------------------ */
/* installation & installation_repositories                             */
/* ------------------------------------------------------------------ */

export async function handleInstallation(payload: Record<string, unknown>): Promise<void> {
  const action = payload.action as string;
  const installation = payload.installation as { account: { id: number; login: string } };
  const repositories = (payload.repositories ?? []) as { id: number; full_name: string }[];

  if (action === 'created') {
    // Add all repositories the user granted access to
    for (const repo of repositories) {
      await supabase.from('repos').upsert(
        {
          github_repo_id: repo.id,
          full_name: repo.full_name,
          owner_github_id: installation.account.id,
          owner_username: installation.account.login,
        },
        { onConflict: 'github_repo_id' }
      );
      console.log(`[Webhook] Installed app on repo: ${repo.full_name}`);
    }
  } else if (action === 'deleted') {
    // Optionally disable or delete repos when the app is uninstalled
    // For now, we will just log it
    console.log(`[Webhook] Uninstalled app from account: ${installation.account.login}`);
  }
}

export async function handleInstallationRepositories(payload: Record<string, unknown>): Promise<void> {
  const action = payload.action as string;
  const installation = payload.installation as { account: { id: number; login: string } };
  const repositoriesAdded = (payload.repositories_added ?? []) as { id: number; full_name: string }[];
  const repositoriesRemoved = (payload.repositories_removed ?? []) as { id: number; full_name: string }[];

  if (action === 'added') {
    for (const repo of repositoriesAdded) {
      await supabase.from('repos').upsert(
        {
          github_repo_id: repo.id,
          full_name: repo.full_name,
          owner_github_id: installation.account.id,
          owner_username: installation.account.login,
        },
        { onConflict: 'github_repo_id' }
      );
      console.log(`[Webhook] Added repo to installation: ${repo.full_name}`);
    }
  } else if (action === 'removed') {
    // Log removal of repos
    for (const repo of repositoriesRemoved) {
      console.log(`[Webhook] Removed repo from installation: ${repo.full_name}`);
    }
  }
}
