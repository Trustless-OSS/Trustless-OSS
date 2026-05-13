import { twFetch } from './client.js';
import { signAndSendTransaction } from '../stellar/signer.js';
import { supabase } from '../supabase.js';
import type { Repo, Issue } from '../../types/index.js';

export async function pushMilestoneOnChain(
  repo: Repo,
  issue: Issue,
  contributorWallet: string
): Promise<void> {
  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;

  // Fetch current escrow state to determine the next milestone index
  const escrowArray = await twFetch(`/helper/get-escrow-by-contract-ids?contractIds[]=${repo.escrow_contract_id}`) as Array<{
    milestones: unknown[];
    [key: string]: unknown;
  }>;
  const escrowData = escrowArray[0];
  
  if (!escrowData) {
    throw new Error(`Escrow not found: ${repo.escrow_contract_id}`);
  }

  const currentMilestones = (escrowData.milestones ?? []) as any[];
  let milestoneIndex = issue.milestone_index;
  let newMilestones = [...currentMilestones];

  const milestoneData = {
    description: `Issue #${issue.github_issue_number}: ${issue.title}`,
    amount: Number(issue.reward_amount),
    status: 'pending',
    evidence: '',
    flags: { approved: false, released: false, disputed: false, resolved: false },
    receiver: contributorWallet,
  };

  if (milestoneIndex != null && milestoneIndex < currentMilestones.length) {
    newMilestones[milestoneIndex] = milestoneData;
  } else {
    milestoneIndex = currentMilestones.length;
    newMilestones.push(milestoneData);
  }

  const { 
    type, createdAt, updatedAt, balance, inconsistencies, 
    contractBaseId, isActive, receiverMemo, ...escrowPayload 
  } = escrowData as any;

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

  await signAndSendTransaction(updateRes.unsignedTransaction);

  // Update issue in DB with on-chain milestone index
  await supabase
    .from('issues')
    .update({ milestone_index: milestoneIndex, status: 'active' })
    .eq('id', issue.id);

  console.log(`[Milestone] Issue #${issue.github_issue_number} pushed on-chain at index ${milestoneIndex}`);
}

export async function releaseEscrowMilestone(repo: Repo, issue: Issue): Promise<string> {
  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;

  if (issue.milestone_index == null) {
    throw new Error(`milestone_index is null for issue #${issue.github_issue_number} — was pushMilestoneOnChain called?`);
  }

  // Step 1: Approve milestone (platformKey must be the escrow approver role)
  try {
    const approveRes = await twFetch('/escrow/multi-release/approve-milestone', {
      method: 'POST',
      body: JSON.stringify({
        approver: platformKey,
        contractId: repo.escrow_contract_id,
        milestoneIndex: String(issue.milestone_index),
      }),
    }) as { unsignedTransaction: string };

    await signAndSendTransaction(approveRes.unsignedTransaction);
  } catch (err: any) {
    // If it's already approved, we can safely proceed to release
    const isAlreadyApproved = err.message.includes('already been approved previously');
    if (isAlreadyApproved) {
      console.log(`[Milestone] Milestone ${issue.milestone_index} already approved, skipping approval step.`);
    } else {
      throw err;
    }
  }

  // Step 2: Release milestone funds
  try {
    const releaseRes = await twFetch('/escrow/multi-release/release-milestone-funds', {
      method: 'POST',
      body: JSON.stringify({
        releaseSigner: platformKey,
        contractId: repo.escrow_contract_id,
        milestoneIndex: String(issue.milestone_index),
      }),
    }) as { unsignedTransaction: string };

    const result = await signAndSendTransaction(releaseRes.unsignedTransaction) as { hash?: string; transactionHash?: string };
    const hash = result.hash || result.transactionHash;

    console.log(`[Milestone] Released milestone ${issue.milestone_index} for issue #${issue.github_issue_number}. Hash: ${hash}`);
    return hash ?? 'success';
  } catch (err: any) {
    // If it's already released, we are done
    const isAlreadyReleased = err.message.includes('already been released previously') || err.message.includes('already been paid');
    if (isAlreadyReleased) {
      console.log(`[Milestone] Milestone ${issue.milestone_index} already released, returning success.`);
      return 'success';
    }

    // Special case: 0-amount milestones sometimes fail with dispute errors or other contract restrictions
    // Since there's no actual value to transfer, we can safely treat it as a database-only completion
    const isDisputeError = err.message.includes('Only the dispute resolver can execute this function');
    if (isDisputeError && Number(issue.reward_amount) === 0) {
      console.log(`[Milestone] Milestone ${issue.milestone_index} (0.00 USDC) encountered a contract restriction. Marking as success locally.`);
      return 'success';
    }

    throw err;
  }
}
