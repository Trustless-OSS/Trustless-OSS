import { supabase } from '../supabase.js';
import { parseLabels, getRewardAmount } from './labels.js';
import { postComment } from './comments.js';
import { pushMilestoneOnChain, releaseEscrowMilestone } from '../trustless-work/milestone.js';
import { twFetch } from '../trustless-work/client.js';
import type { Repo, Contributor, Issue, Assignment } from '../../types/index.js';

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

function extractIssueNumber(body: string | null): number | null {
  if (!body) return null;
  // Match keywords followed by optional colon/space and #number
  const match = body.match(/(?:close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)[:\s]*#\s*(\d+)/i);
  return match ? parseInt(match[1]!, 10) : null;
}

/** Parse "@Trustless-OSS 50" or "@Trustless-OSS 0.5 USDC" from issue body */
function extractCustomAmount(body: string | null): number | null {
  if (!body) return null;
  const match = body.match(/@Trustless-OSS\s+([\d.]+)/i);
  if (!match) return null;
  const amount = parseFloat(match[1]!);
  return isNaN(amount) || amount <= 0 ? null : amount;
}

/** Check if PR labels include "rejected" */
function hasRejectedLabel(labels: { name: string }[]): boolean {
  return labels.some((l) => l.name.toLowerCase() === 'rejected');
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
    body: string | null;
    labels: { name: string }[];
  };

  const eventLabel = (payload.label as { name: string })?.name.toLowerCase();
  const difficultyLabels = ['low', 'medium', 'high', 'custom'];
  const isTriggerLabel = eventLabel === 'rewarded' || difficultyLabels.includes(eventLabel) || eventLabel === 'rejected';

  if (!isTriggerLabel) return;

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('github_repo_id', repository.id)
    .single<Repo>();

  if (!repo || !repo.escrow_contract_id) return;

  // Idempotency — check if already created in DB
  const { data: existing } = await supabase
    .from('issues')
    .select('*')
    .eq('repo_id', repo.id)
    .eq('github_issue_id', issue.id)
    .single<Issue>();

  if (eventLabel === 'rejected') {
    if (existing && existing.status !== 'completed' && existing.status !== 'cancelled') {
      await supabase.from('issues').update({ status: 'cancelled' }).eq('id', existing.id);
      await supabase.from('assignments').delete().eq('issue_id', existing.id);
      await supabase.from('repos').update({ escrow_balance: repo.escrow_balance + existing.reward_amount }).eq('id', repo.id);
      await postComment(repository.full_name, issue.number, `🚫 **Bounty Cancelled.**\n\nThis issue was rejected by a maintainer. The **${existing.reward_amount} USDC** bounty has been refunded to the pool.`);
    }
    return;
  }

  const parsed = parseLabels(issue.labels);
  if (!parsed.isRewarded || !parsed.difficulty) return;

  // If already completed or active on-chain, don't allow changes
  if (existing && existing.status !== 'pending') return;

  // For "custom" difficulty, extract amount from issue body (@Trustless-OSS <amount>)
  let customAmount: number | undefined;
  if (parsed.difficulty === 'custom') {
    const amt = extractCustomAmount(issue.body);
    if (!amt) {
      if (!existing) {
        await postComment(
          repository.full_name,
          issue.number,
          `⚠️ Custom bounty requires an amount. comment with \`@Trustless-OSS <amount>\` in the issue comment section.`
        );
      }
      return;
    }
    customAmount = amt;
  }

  const rewardAmount = getRewardAmount(parsed.difficulty, repo, customAmount);

  // ... (balance syncing code here) ...

  if (existing) {
    // Update existing pending bounty
    await supabase.from('issues').update({
      reward_amount: rewardAmount,
      difficulty_label: parsed.difficulty
    }).eq('id', existing.id);
    
    console.log(`[Webhook] Updated bounty amount: ${repository.full_name}#${issue.number} -> ${rewardAmount} USDC`);
    
    await postComment(
      repository.full_name, 
      issue.number, 
      `🔄 Bounty updated to **${rewardAmount} USDC** (Level: \`${parsed.difficulty}\`)`
    );
    return;
  }

  // Sync balance from on-chain before solvency check
  try {
    const escrowArray = await twFetch(`/helper/get-escrow-by-contract-ids?contractIds[]=${repo.escrow_contract_id}`) as any[];
    const onChainBalance = Number(escrowArray[0]?.balance ?? 0);
    if (onChainBalance !== repo.escrow_balance) {
      console.log(`[Webhook] Syncing balance for ${repo.id}: ${repo.escrow_balance} -> ${onChainBalance}`);
      await supabase.from('repos').update({ escrow_balance: onChainBalance }).eq('id', repo.id);
      repo.escrow_balance = onChainBalance;
    }
  } catch (e) {
    console.error('[Webhook] Failed to sync balance:', e);
  }

  // Solvency check — only if reward is set
  if (rewardAmount > 0 && repo.escrow_balance < rewardAmount) {
    await postComment(
      repository.full_name,
      issue.number,
      `⚠️ Insufficient escrow balance (**${repo.escrow_balance} USDC**). Need **${rewardAmount} USDC** to reward this issue.\n\n[Top up your escrow →](${process.env.APP_URL}/dashboard)`
    );
    return;
  }

  // Create milestone record in DB (idempotent via unique constraint)
  const { error: insertError } = await supabase.from('issues').insert({
    repo_id: repo.id,
    github_issue_id: issue.id,
    github_issue_number: issue.number,
    title: issue.title,
    reward_amount: rewardAmount,
    difficulty_label: parsed.difficulty,
    status: 'pending',
  });

  if (insertError) {
    if (insertError.code === '23505') return; // Already created by another concurrent webhook
    throw insertError;
  }

  // Reserve balance
  const newBalance = Math.round((repo.escrow_balance - rewardAmount) * 1e7) / 1e7;
  await supabase
    .from('repos')
    .update({ escrow_balance: newBalance })
    .eq('id', repo.id);

  await postComment(
    repository.full_name,
    issue.number,
    `🎯 Bounty of **${rewardAmount} USDC** created for this issue!\n\n` +
    `| Detail | Value |\n|---|---|\n` +
    `| 💰 Reward | **${rewardAmount} USDC** |\n` +
    `| 📊 Level | \`${parsed.difficulty}\` |\n` +
    `| 📋 Escrow | [View on-chain →](https://viewer.trustlesswork.com/${repo.escrow_contract_id}) |\n\n` +
    `Assign a contributor to get started.`
  );

  console.log(`[Webhook] Created bounty issue: ${repository.full_name}#${issue.number} → ${rewardAmount} USDC`);
}

/* ------------------------------------------------------------------ */
/* issue_comment.created — handle @Trustless-OSS <amount> comments      */
/* ------------------------------------------------------------------ */

export async function handleIssueCommentCreated(payload: Record<string, unknown>): Promise<void> {
  const repository = payload.repository as { id: number; full_name: string };
  const issue = payload.issue as {
    id: number;
    number: number;
    title: string;
    body: string | null;
    labels: { name: string }[];
    user: { id: number; login: string };
  };
  const comment = payload.comment as {
    body: string;
    user: { login: string; id: number; type: string };
    author_association: string;
  };

  // Ignore comments from bots (to prevent self-triggering from example text)
  if (comment.user.type === 'Bot') return;

  const isPrivileged = ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(comment.author_association);

  // Check for maintainer PR commands (/work-completion or /rejected)
  const isWorkCompletion = comment.body.match(/@Trustless-OSS\s+\/work-completion\s+(\d+)/i);
  const isRejected = comment.body.includes('@Trustless-OSS /rejected');

  if (isPrivileged && (isWorkCompletion || isRejected)) {
    const isPR = !!(payload.issue as any).pull_request;
    const { data: repo } = await supabase.from('repos').select('*').eq('github_repo_id', repository.id).single<Repo>();
    if (!repo) return;

    let targetIssue: Issue | null = null;
    let targetIssueNumber: number = issue.number;
    let prAuthorId: number | null = null;

    if (isPR) {
      // It's a PR, so issue.body is the PR body
      const extractedNumber = extractIssueNumber(issue.body);
      if (!extractedNumber) {
        console.log('[Webhook] PR comment command but no linked issue found in PR body');
        return;
      }
      targetIssueNumber = extractedNumber;
      prAuthorId = issue.user.id; // Issue author IS the PR author in this payload context
    } else {
      // It's an issue comment, so it targets this exact issue
      targetIssueNumber = issue.number;
    }

    const { data: existing } = await supabase.from('issues').select('*').eq('repo_id', repo.id).eq('github_issue_number', targetIssueNumber).single<Issue>();
    if (!existing || existing.status !== 'active') {
      if (isRejected && existing && existing.status !== 'completed' && existing.status !== 'cancelled') {
        // Fallback for non-active rejected (from before milestone was active)
        await supabase.from('issues').update({ status: 'cancelled' }).eq('id', existing.id);
        await supabase.from('assignments').delete().eq('issue_id', existing.id);
        await supabase.from('repos').update({ escrow_balance: repo.escrow_balance + existing.reward_amount }).eq('id', repo.id);
        await postComment(repository.full_name, issue.number, `🚫 **Bounty Cancelled.**\n\nThis issue was rejected by a maintainer. The **${existing.reward_amount} USDC** bounty has been refunded to the pool.`);
      }
      return;
    }

    targetIssue = existing;

    const { data: assignment } = await supabase.from('assignments').select('*, contributors(*)').eq('issue_id', targetIssue.id).single<Assignment>();
    if (!assignment || !assignment.contributors) return;

    if (isPR && assignment.contributors.github_user_id !== prAuthorId) {
      await postComment(
        repository.full_name,
        issue.number,
        `⚠️ The author of this PR does not match the assigned contributor for issue #${targetIssueNumber}.`
      );
      return;
    }

    if (targetIssue.milestone_index == null) {
      console.log('[Webhook] Missing milestone index for active issue');
      return;
    }

    const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;
    const maintainerGithubId = repo.installer_github_id ?? repo.owner_github_id;
    const { data: maintainer } = await supabase.from('contributors').select('stellar_wallet').eq('github_user_id', maintainerGithubId).single();

    if (!maintainer?.stellar_wallet) {
      const connectUrl = `${process.env.APP_URL}/connect`;
      await postComment(repository.full_name, issue.number, `⚠️ @${comment.user.login}, you must connect your Stellar wallet to process this command. \n\n[**Connect Wallet Here →**](${connectUrl})`);
      return;
    }

    if (isWorkCompletion) {
      const percentage = parseInt(isWorkCompletion[1]!, 10);
      if (percentage < 1 || percentage > 99) {
        await postComment(repository.full_name, issue.number, `⚠️ Percentage must be between 1 and 99. No changes made.`);
        return;
      }

      if (!assignment.contributors.stellar_wallet) {
        await postComment(repository.full_name, issue.number, `⚠️ @${assignment.contributors.github_username} must connect their Stellar wallet before a partial payment can be configured.`);
        return;
      }

      // Store intent — no on-chain transaction yet
      await supabase.from('assignments').update({ completion_percentage: percentage }).eq('id', assignment.id);

      const contributorAmount = parseFloat((targetIssue.reward_amount * (percentage / 100)).toFixed(7));
      const maintainerAmount = parseFloat((targetIssue.reward_amount - contributorAmount).toFixed(7));

      await postComment(
        repository.full_name,
        targetIssueNumber,
        `📋 **Work Completion Intent Saved** (${percentage}%)\n\n` +
        `When this PR is merged, the bounty will be split as follows:\n` +
        `- **${contributorAmount} USDC** → @${assignment.contributors.github_username}\n` +
        `- **${maintainerAmount} USDC** → returned to maintainer\n\n` +
        `_You can update this at any time before merging by posting a new \`/work-completion <percentage>\` command._\n\n` +
        `[View Escrow](https://viewer.trustlesswork.com/${repo.escrow_contract_id})`
      );

      return;
    } else if (isRejected) {
      // Dispute
      try {
        const disputeRes = await twFetch('/escrow/multi-release/dispute-milestone', {
          method: 'POST',
          body: JSON.stringify({ signer: platformKey, contractId: repo.escrow_contract_id, milestoneIndex: String(targetIssue.milestone_index) })
        }) as { unsignedTransaction: string };
        const { signAndSendTransaction } = await import('../stellar/signer.js');
        await signAndSendTransaction(disputeRes.unsignedTransaction);
      } catch (e: any) {
        if (!e.message.includes('already in dispute')) throw e;
      }

      // Resolve 100% to maintainer
      try {
        const resolveRes = await twFetch('/escrow/multi-release/resolve-milestone-dispute', {
          method: 'POST',
          body: JSON.stringify({
            disputeResolver: platformKey,
            contractId: repo.escrow_contract_id,
            milestoneIndex: String(targetIssue.milestone_index),
            distributions: [
              { address: maintainer.stellar_wallet, amount: Number(targetIssue.reward_amount) }
            ]
          })
        }) as { unsignedTransaction: string };
        const { signAndSendTransaction } = await import('../stellar/signer.js');
        await signAndSendTransaction(resolveRes.unsignedTransaction);
      } catch (e: any) {
        if (!e.message.includes('already resolved') && !e.message.includes('already released')) throw e;
      }

      await supabase.from('issues').update({ status: 'cancelled' }).eq('id', targetIssue.id);
      await supabase.from('assignments').update({ payout_status: 'failed' }).eq('id', assignment.id);
      await supabase.from('repos').update({ escrow_balance: repo.escrow_balance + targetIssue.reward_amount }).eq('id', repo.id);

      await postComment(
        repository.full_name,
        targetIssueNumber,
        `🚫 **Bounty Rejected.**\n\nThe maintainer rejected the work. **${targetIssue.reward_amount} USDC** was returned to the maintainer's wallet.\n\n[View Escrow](https://viewer.trustlesswork.com/${repo.escrow_contract_id})`
      );

      return;
    }
  }

  // Check for contributor address change via connect link
  if (comment.body.match(/@Trustless-OSS\s+\/change-address/i)) {
    const connectUrl = `${process.env.APP_URL}/connect?issue=${issue.id}&repo=${repository.id}`;
    await postComment(
      repository.full_name,
      issue.number,
      `👋 Hey @${comment.user.login}! You can update your Stellar wallet address here: [**Update Wallet →**](${connectUrl})`
    );
    return;
  }

  // Check for help command
  if (comment.body.match(/@Trustless-OSS\s+\/help/i)) {
    const helpMsg = `🤖 **Trustless-OSS Bot Commands**\n\n` +
      `**For Maintainers:**\n` +
      `- \`@Trustless-OSS <amount>\` : Create a custom bounty (e.g. \`@Trustless-OSS 50\`)\n` +
      `- \`@Trustless-OSS /rejected\` : Cancel the bounty and refund the escrow\n` +
      `- \`@Trustless-OSS /retry\` : Retry a failed payout transaction\n\n` +
      `**For Contributors:**\n` +
      `- \`@Trustless-OSS /change-address\` : Get a link to update your connected Stellar wallet`;
      
    await postComment(repository.full_name, issue.number, helpMsg);
    return;
  }

  // Check for maintainer retry
  if (isPrivileged && comment.body.includes('@Trustless-OSS /retry')) {
    const { data: repo } = await supabase.from('repos').select('*').eq('github_repo_id', repository.id).single<Repo>();
    if (!repo) return;
    
    const { data: existing } = await supabase.from('issues').select('*').eq('repo_id', repo.id).eq('github_issue_id', issue.id).single<Issue>();
    if (!existing) return;

    const { data: assignment } = await supabase.from('assignments').select('*, contributors(*)').eq('issue_id', existing.id).single<Assignment>();
    if (!assignment) {
      await postComment(repository.full_name, issue.number, `⚠️ Cannot retry: No contributor is assigned.`);
      return;
    }

    if (existing.status === 'completed' && assignment.payout_status === 'released') {
      await postComment(repository.full_name, issue.number, `ℹ️ The bounty has already been successfully released.`);
      return;
    }

    // Try to push if pending
    if (existing.status === 'pending') {
      if (!assignment.contributors?.stellar_wallet) {
         await postComment(repository.full_name, issue.number, `⚠️ Cannot retry: Contributor has not connected a wallet yet.`);
         return;
      }
      try {
        await pushMilestoneOnChain(repo, existing, assignment.contributors.stellar_wallet);
        existing.status = 'active';
        const { data: updatedIssue } = await supabase.from('issues').select('*').eq('id', existing.id).single<Issue>();
        if (updatedIssue) existing.milestone_index = updatedIssue.milestone_index;
      } catch (e: any) {
        await postComment(repository.full_name, issue.number, `⚠️ Failed to push milestone on-chain: ${e.message}`);
        return;
      }
    }

    // Now try to release if active
    if (existing.status === 'active') {
      const issueState = (payload.issue as any).state;
      if (issueState !== 'closed') {
        await postComment(repository.full_name, issue.number, `⚠️ Cannot release funds: Issue/PR is not closed yet.`);
        return;
      }

      const txHash = await releaseEscrowMilestone(repo, existing);
      if (txHash) {
        await supabase.from('assignments').update({ payout_status: 'released' }).eq('id', assignment.id);
        await supabase.from('issues').update({ status: 'completed' }).eq('id', existing.id);

        const username = assignment.contributors?.github_username ?? 'contributor';
        const explorerUrl = txHash !== 'success'
          ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
          : `https://stellar.expert/explorer/testnet/contract/${repo.escrow_contract_id}`;

        await postComment(
          repository.full_name,
          issue.number,
          `🎉 **Bounty Released (Retry Successful)!**\n\n` +
          `| Detail | Value |\n|---|---|\n` +
          `| 💰 Amount | **${existing.reward_amount} USDC** |\n` +
          `| 👤 Recipient | @${username} |\n` +
          `| 🔗 Transaction | [View on Stellar Explorer →](${explorerUrl}) |\n` +
          `| 📋 Escrow | [View on Trustless Work →](https://viewer.trustlesswork.com/${repo.escrow_contract_id}) |\n\n` +
          `Thanks for your contribution! 🚀`
        );
      } else {
        await postComment(repository.full_name, issue.number, `⚠️ Retry failed. The transaction could not be processed. Check escrow balance or contract state.`);
      }
    }
    return;
  }

  // Only process the rest (custom amounts) from repo owner/maintainers
  if (!isPrivileged) return;

  // Check for @Trustless-OSS <amount> pattern
  const customAmount = extractCustomAmount(comment.body);
  if (!customAmount) return;

  const { data: repo } = await supabase
    .from('repos')
    .select('*')
    .eq('github_repo_id', repository.id)
    .single<Repo>();

  if (!repo || !repo.escrow_contract_id) return;

  // Skip if this issue already has a bounty
  const { data: existing } = await supabase
    .from('issues')
    .select('*')
    .eq('repo_id', repo.id)
    .eq('github_issue_id', issue.id)
    .single<Issue>();

  if (existing && existing.status !== 'pending') return;

  // Sync balance from on-chain before solvency check
  // ... (sync logic) ...

  if (existing) {
    // Update existing pending bounty
    await supabase.from('issues').update({
      reward_amount: customAmount,
      difficulty_label: 'custom'
    }).eq('id', existing.id);

    await postComment(
      repository.full_name,
      issue.number,
      `🔄 Bounty updated to **${customAmount} USDC**!`
    );
    return;
  }

  // Sync balance from on-chain before solvency check
  try {
    const escrowArray = await twFetch(`/helper/get-escrow-by-contract-ids?contractIds[]=${repo.escrow_contract_id}`) as any[];
    const onChainBalance = Number(escrowArray[0]?.balance ?? 0);
    if (onChainBalance !== repo.escrow_balance) {
      console.log(`[Webhook] Syncing balance for ${repo.id}: ${repo.escrow_balance} -> ${onChainBalance}`);
      await supabase.from('repos').update({ escrow_balance: onChainBalance }).eq('id', repo.id);
      repo.escrow_balance = onChainBalance;
    }
  } catch (e) {
    console.error('[Webhook] Failed to sync balance:', e);
  }

  // Solvency check
  if (repo.escrow_balance < customAmount) {
    await postComment(
      repository.full_name,
      issue.number,
      `⚠️ Insufficient escrow balance (**${repo.escrow_balance} USDC**). Need **${customAmount} USDC** to reward this issue.\n\n[Top up your escrow →](${process.env.APP_URL}/dashboard)`
    );
    return;
  }

  // Create bounty (idempotent via unique constraint)
  const { error: insertError } = await supabase.from('issues').insert({
    repo_id: repo.id,
    github_issue_id: issue.id,
    github_issue_number: issue.number,
    title: issue.title,
    reward_amount: customAmount,
    difficulty_label: 'custom',
    status: 'pending',
  });

  if (insertError) {
    if (insertError.code === '23505') return;
    throw insertError;
  }

  const newBalance = Math.round((repo.escrow_balance - customAmount) * 1e7) / 1e7;
  await supabase
    .from('repos')
    .update({ escrow_balance: newBalance })
    .eq('id', repo.id);

  await postComment(
    repository.full_name,
    issue.number,
    `🎯 Bounty of **${customAmount} USDC** created by @${comment.user.login}!\n\n` +
    `| Detail | Value |\n|---|---|\n` +
    `| 💰 Reward | **${customAmount} USDC** |\n` +
    `| 📊 Level | \`custom\` |\n` +
    `| 📋 Escrow | [View on-chain →](https://viewer.trustlesswork.com/${repo.escrow_contract_id}) |\n\n` +
    `Assign a contributor to get started.`
  );

  console.log(`[Webhook] Custom bounty via comment: ${repository.full_name}#${issue.number} → ${customAmount} USDC`);
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

  if (!issueRecord) return;
  if (issueRecord.status === 'completed' || issueRecord.status === 'cancelled') return;

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
      `✅ Bounty of **${issueRecord.reward_amount} USDC** locked on-chain for @${assignee.login}!\n\n` +
      `| Detail | Value |\n|---|---|\n` +
      `| 🔒 Locked | **${issueRecord.reward_amount} USDC** |\n` +
      `| 👤 Contributor | @${assignee.login} |\n` +
      `| 📋 Escrow | [View on-chain →](https://viewer.trustlesswork.com/${repo.escrow_contract_id}) |\n\n` +
      `Merge the PR to release funds.`
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
  const repository = payload.repository as { id: number; full_name: string };
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

  // 1. Remove the assignment
  await supabase.from('assignments').delete().eq('issue_id', issueRecord.id);

  // 2. If it was active on-chain, close the milestone by zeroing it out
  if (issueRecord.status === 'active' && issueRecord.milestone_index != null) {
    const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;

    try {
      const escrowArray = await twFetch(`/helper/get-escrow-by-contract-ids?contractIds[]=${repo.escrow_contract_id}`) as any[];
      const escrowData = escrowArray[0];

      if (escrowData && escrowData.milestones) {
        let newMilestones = [...escrowData.milestones];
        if (issueRecord.milestone_index < newMilestones.length) {
          newMilestones[issueRecord.milestone_index] = {
            ...newMilestones[issueRecord.milestone_index],
            amount: 0,
            receiver: platformKey, // dummy receiver
          };

          const {
            type, createdAt, updatedAt, balance, inconsistencies,
            contractBaseId, isActive, receiverMemo, ...escrowPayload
          } = escrowData;

          const updateRes = await twFetch('/escrow/multi-release/update-escrow', {
            method: 'PUT',
            body: JSON.stringify({
              signer: platformKey,
              contractId: repo.escrow_contract_id,
              escrow: {
                ...escrowPayload,
                milestones: newMilestones,
              },
            }),
          }) as { unsignedTransaction: string };

          const { signAndSendTransaction } = await import('../stellar/signer.js');
          await signAndSendTransaction(updateRes.unsignedTransaction);
        }
      }
    } catch (err) {
      console.error('[Webhook] Failed to zero out milestone on unassign:', err);
    }
  }

  // 3. Set issue back to pending and clear milestone index so reassignment creates a new one
  await supabase.from('issues').update({ status: 'pending', milestone_index: null }).eq('id', issueRecord.id);

  await postComment(
    repository.full_name,
    issue.number,
    `🔄 Contributor unassigned. The milestone has been closed. The bounty of **${issueRecord.reward_amount} USDC** remains available for the next assignee.`
  );

  console.log(`[Webhook] Unassigned and closed milestone for issue #${issue.number}`);
}

/* ------------------------------------------------------------------ */
/* issues.closed — Backup release trigger                                */
/* ------------------------------------------------------------------ */
export async function handleIssueClosed(payload: Record<string, unknown>): Promise<void> {
  const repository = payload.repository as { id: number; full_name: string };
  const issue = payload.issue as {
    id: number;
    number: number;
    state_reason: string | null;
  };

  // Only proceed if closed as "completed" (not "not_planned")
  if (issue.state_reason !== 'completed') return;

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

  if (!issueRecord || (issueRecord.status !== 'pending' && issueRecord.status !== 'active')) return;

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*, contributors(*)')
    .eq('issue_id', issueRecord.id)
    .single<Assignment>();

  if (!assignment || assignment.payout_status === 'released') return;
  if (!assignment.contributors?.stellar_wallet) return;

  // If issue is still pending, push milestone first
  if (issueRecord.status === 'pending') {
    console.log(`[Webhook] Issue #${issue.number} is still pending. Pushing milestone before release...`);
    await pushMilestoneOnChain(repo, issueRecord, assignment.contributors.stellar_wallet);
    // Refresh issueRecord after push
    issueRecord.status = 'active';
    const { data: updatedIssue } = await supabase.from('issues').select('*').eq('id', issueRecord.id).single<Issue>();
    if (updatedIssue) issueRecord.milestone_index = updatedIssue.milestone_index;
  }

  // Approve + release via Trustless Work
  try {
    const txHash = await releaseEscrowMilestone(repo, issueRecord);

    await supabase.from('assignments').update({ payout_status: 'released' }).eq('id', assignment.id);
    await supabase.from('issues').update({ status: 'completed' }).eq('id', issueRecord.id);

    const username = assignment.contributors?.github_username ?? 'contributor';
    const explorerUrl = txHash !== 'success'
      ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
      : `https://stellar.expert/explorer/testnet/contract/${repo.escrow_contract_id}`;

    await postComment(
      repository.full_name,
      issue.number,
      `🎉 **Bounty Released (Issue Closed)!**\n\n` +
      `| Detail | Value |\n|---|---|\n` +
      `| 💰 Amount | **${issueRecord.reward_amount} USDC** |\n` +
      `| 👤 Recipient | @${username} |\n` +
      `| 🔗 Transaction | [View on Stellar Explorer →](${explorerUrl}) |\n` +
      `| 📋 Escrow | [View on Trustless Work →](https://viewer.trustlesswork.com/${repo.escrow_contract_id}) |\n\n` +
      `Thanks for your contribution! 🚀`
    );
  } catch (releaseErr: any) {
    console.error('[Webhook] releaseEscrowMilestone failed (issue closed):', releaseErr.message);
    await postComment(
      repository.full_name,
      issue.number,
      `⚠️ Bounty release failed: ${releaseErr.message}\n\nPlease use the dashboard retry button.`
    );
  }
}

/* ------------------------------------------------------------------ */
/* pull_request.closed (merged)                                         */
/* ------------------------------------------------------------------ */

export async function handlePRMerged(payload: Record<string, unknown>): Promise<void> {
  const repository = payload.repository as { id: number; full_name: string };
  const pr = payload.pull_request as {
    number: number;
    body: string | null;
    labels: { name: string }[];
    user: { id: number; login: string };
  };

  // If PR has "rejected" label, skip payout entirely
  if (hasRejectedLabel(pr.labels ?? [])) {
    console.log(`[Webhook] PR #${pr.number} has 'rejected' label — skipping payout`);
    return;
  }

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

  if (!issueRecord || (issueRecord.status !== 'pending' && issueRecord.status !== 'active')) return;

  const { data: assignment } = await supabase
    .from('assignments')
    .select('*, contributors(*)')
    .eq('issue_id', issueRecord.id)
    .single<Assignment>();

  if (!assignment || assignment.payout_status === 'released') return;

  if (assignment.contributors?.github_user_id !== pr.user.id) {
    await postComment(
      repository.full_name,
      issueNumber,
      `⚠️ The author of this PR does not match the assigned contributor for issue #${issueNumber}. Payout aborted.`
    );
    return;
  }

  // If issue is still pending, push milestone first (needs a wallet)
  if (issueRecord.status === 'pending') {
    if (!assignment.contributors?.stellar_wallet) {
      console.log(`[Webhook] PR merged for #${issueNumber} but contributor has no wallet. Skipping release.`);
      return;
    }
    console.log(`[Webhook] PR merged for #${issueNumber} but issue is pending. Pushing milestone first...`);
    await pushMilestoneOnChain(repo, issueRecord, assignment.contributors.stellar_wallet);
    // Refresh
    const { data: updatedIssue } = await supabase.from('issues').select('*').eq('id', issueRecord.id).single<Issue>();
    if (updatedIssue) {
      issueRecord.status = 'active';
      issueRecord.milestone_index = updatedIssue.milestone_index;
    }
  }

  // Record the PR merge
  await supabase
    .from('assignments')
    .update({ pr_number: pr.number, pr_merged_at: new Date().toISOString() })
    .eq('id', assignment.id);

  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;
  const completionPct = (assignment as any).completion_percentage as number | null;

  if (completionPct != null && completionPct > 0 && completionPct < 100) {
    // Partial payment flow — maintainer set /work-completion before merge
    const maintainerGithubId = repo.installer_github_id ?? repo.owner_github_id;
    const { data: maintainer } = await supabase.from('contributors').select('stellar_wallet').eq('github_user_id', maintainerGithubId).single();

    if (!maintainer?.stellar_wallet) {
      const connectUrl = `${process.env.APP_URL}/connect`;
      await postComment(repository.full_name, issueNumber,
        `⚠️ Partial payment could not be processed — the maintainer has not connected a Stellar wallet. [Connect here →](${connectUrl})`);
      return;
    }

    if (!assignment.contributors?.stellar_wallet) {
      await postComment(repository.full_name, issueNumber,
        `⚠️ Partial payment could not be processed — @${assignment.contributors?.github_username} has not connected a Stellar wallet.`);
      return;
    }

    const contributorAmount = parseFloat((issueRecord.reward_amount * (completionPct / 100)).toFixed(7));
    const maintainerAmount = parseFloat((issueRecord.reward_amount - contributorAmount).toFixed(7));

    try {
      // Dispute
      try {
        const disputeRes = await twFetch('/escrow/multi-release/dispute-milestone', {
          method: 'POST',
          body: JSON.stringify({ signer: platformKey, contractId: repo.escrow_contract_id, milestoneIndex: String(issueRecord.milestone_index) })
        }) as { unsignedTransaction: string };
        const { signAndSendTransaction } = await import('../stellar/signer.js');
        await signAndSendTransaction(disputeRes.unsignedTransaction);
      } catch (e: any) {
        if (!e.message.includes('already in dispute')) throw e;
      }

      // Resolve split
      const resolveRes = await twFetch('/escrow/multi-release/resolve-milestone-dispute', {
        method: 'POST',
        body: JSON.stringify({
          disputeResolver: platformKey,
          contractId: repo.escrow_contract_id,
          milestoneIndex: String(issueRecord.milestone_index),
          distributions: [
            { address: assignment.contributors.stellar_wallet, amount: contributorAmount },
            { address: maintainer.stellar_wallet, amount: maintainerAmount }
          ]
        })
      }) as { unsignedTransaction: string };
      const { signAndSendTransaction } = await import('../stellar/signer.js');
      await signAndSendTransaction(resolveRes.unsignedTransaction);

      await supabase.from('assignments').update({ payout_status: 'released' }).eq('id', assignment.id);
      await supabase.from('issues').update({ status: 'completed' }).eq('id', issueRecord.id);

      const username = assignment.contributors.github_username ?? 'contributor';
      await postComment(
        repository.full_name,
        issueNumber,
        `✅ **Partial Payment Released (${completionPct}%)!**\n\n` +
        `| Detail | Value |\n|---|---|\n` +
        `| 💰 Contributor (${completionPct}%) | **${contributorAmount} USDC** → @${username} |\n` +
        `| 🔄 Returned to Maintainer | **${maintainerAmount} USDC** |\n` +
        `| 📋 Escrow | [View on Trustless Work →](https://viewer.trustlesswork.com/${repo.escrow_contract_id}) |\n\n` +
        `Thanks for your contribution! 🚀`
      );
    } catch (releaseErr: any) {
      console.error('[Webhook] Partial payment failed on merge:', releaseErr.message);
      await postComment(repository.full_name, issueNumber,
        `⚠️ Partial payment failed: ${releaseErr.message}\n\nPlease use the dashboard retry button.`);
    }
    return;
  }

  // Full release via Trustless Work (no /work-completion set)
  try {
    const txHash = await releaseEscrowMilestone(repo, issueRecord);

    await supabase.from('assignments').update({ payout_status: 'released' }).eq('id', assignment.id);
    await supabase.from('issues').update({ status: 'completed' }).eq('id', issueRecord.id);

    const username = assignment.contributors?.github_username ?? 'contributor';
    const explorerUrl = txHash !== 'success'
      ? `https://stellar.expert/explorer/testnet/tx/${txHash}`
      : `https://stellar.expert/explorer/testnet/contract/${repo.escrow_contract_id}`;

    await postComment(
      repository.full_name,
      issueNumber,
      `🎉 **Bounty Released!**\n\n` +
      `| Detail | Value |\n|---|---|\n` +
      `| 💰 Amount | **${issueRecord.reward_amount} USDC** |\n` +
      `| 👤 Recipient | @${username} |\n` +
      `| 🔗 Transaction | [View on Stellar Explorer →](${explorerUrl}) |\n` +
      `| 📋 Escrow | [View on Trustless Work →](https://viewer.trustlesswork.com/${repo.escrow_contract_id}) |\n\n` +
      `Thanks for your contribution! 🚀`
    );
  } catch (releaseErr: any) {
    console.error('[Webhook] releaseEscrowMilestone failed (PR merged):', releaseErr.message);
    await supabase.from('assignments').update({ payout_status: 'failed' }).eq('id', assignment.id);
    await postComment(
      repository.full_name,
      issueNumber,
      `⚠️ Bounty release failed: ${releaseErr.message}\n\nPlease use the dashboard retry button.`
    );
  }
}

/* ------------------------------------------------------------------ */
/* installation & installation_repositories                             */
/* ------------------------------------------------------------------ */

export async function handleInstallation(payload: Record<string, unknown>): Promise<void> {
  const action = payload.action as string;
  const installation = payload.installation as { 
    id: number; 
    account: { id: number; login: string; type: string };
  };
  const repositories = (payload.repositories ?? []) as { 
    id: number; 
    full_name: string;
    private: boolean;
    fork: boolean;
  }[];
  const sender = payload.sender as { id: number };

  if (action === 'created') {
    // Only allow installations on User accounts (not Organizations)
    if (installation.account.type !== 'User') {
      console.log(`[Webhook] ⏭️ Skipping installation on ${installation.account.type}: ${installation.account.login}`);
      return;
    }

    for (const repo of repositories) {
      // Filter out forks and private repositories
      if (repo.fork || repo.private) {
        console.log(`[Webhook] ⏭️ Skipping repo (fork/private): ${repo.full_name}`);
        continue;
      }

      const { error } = await supabase.from('repos').upsert(
        {
          github_repo_id: repo.id,
          full_name: repo.full_name,
          owner_github_id: installation.account.id,
          owner_username: installation.account.login,
          owner_type: installation.account.type,
          is_fork: repo.fork,
          is_private: repo.private,
          reward_low: 0.01,
          reward_medium: 0.02,
          reward_high: 0.03,
          installer_github_id: sender.id,
          github_installation_id: (installation as any).id,
        },
        { onConflict: 'github_repo_id' }
      );
      
      if (error) {
        console.error(`[Webhook] ❌ Failed to save repo ${repo.full_name}:`, error.message);
      } else {
        console.log(`[Webhook] ✅ Installed app on repo: ${repo.full_name} (Installer: ${sender.id}, Installation: ${(installation as any).id})`);
      }
    }
  } else if (action === 'deleted') {
    // Optionally disable or delete repos when the app is uninstalled
    console.log(`[Webhook] 🗑️ Uninstalled app from account: ${installation.account.login}`);
  }
}

export async function handleInstallationRepositories(payload: Record<string, unknown>): Promise<void> {
  const action = payload.action as string;
  const installation = payload.installation as { 
    id: number; 
    account: { id: number; login: string; type: string };
  };
  const repositoriesAdded = (payload.repositories_added ?? []) as { 
    id: number; 
    full_name: string;
    private: boolean;
    fork: boolean;
  }[];
  const repositoriesRemoved = (payload.repositories_removed ?? []) as { id: number; full_name: string }[];
  const sender = payload.sender as { id: number };

  if (action === 'added') {
    // Only allow for User accounts
    if (installation.account.type !== 'User') {
      console.log(`[Webhook] ⏭️ Skipping added repos for ${installation.account.type}: ${installation.account.login}`);
      return;
    }

    for (const repo of repositoriesAdded) {
      // Filter out forks and private repositories
      if (repo.fork || repo.private) {
        console.log(`[Webhook] ⏭️ Skipping added repo (fork/private): ${repo.full_name}`);
        continue;
      }

      const { error } = await supabase.from('repos').upsert(
        {
          github_repo_id: repo.id,
          full_name: repo.full_name,
          owner_github_id: installation.account.id,
          owner_username: installation.account.login,
          owner_type: installation.account.type,
          is_fork: repo.fork,
          is_private: repo.private,
          reward_low: 0.01,
          reward_medium: 0.02,
          reward_high: 0.03,
          installer_github_id: sender.id,
          github_installation_id: installation.id,
        },
        { onConflict: 'github_repo_id' }
      );

      if (error) {
        console.error(`[Webhook] ❌ Failed to add repo ${repo.full_name}:`, error.message);
      } else {
        console.log(`[Webhook] ✅ Added repo to installation: ${repo.full_name} (Installer: ${sender.id})`);
      }
    }
  } else if (action === 'removed') {
    for (const repo of repositoriesRemoved) {
      console.log(`[Webhook] ➖ Removed repo from installation: ${repo.full_name}`);
    }
  }
}
