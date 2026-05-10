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

  const currentMilestones = escrowData.milestones ?? [];
  const milestoneIndex = currentMilestones.length;

  // The update API expects a strict schema and rejects read-only properties
  const { 
    type, 
    createdAt, 
    updatedAt, 
    balance, 
    inconsistencies, 
    contractBaseId,
    isActive,
    receiverMemo,
    ...escrowPayload 
  } = escrowData as any;

  // Add new milestone to escrow
  const updateRes = await twFetch('/escrow/multi-release/update-escrow', {
    method: 'PUT',
    body: JSON.stringify({
      signer: platformKey,
      contractId: repo.escrow_contract_id,
      escrow: {
        ...escrowPayload,
        milestones: [
          ...currentMilestones,
          {
            description: `Issue #${issue.github_issue_number}: ${issue.title}`,
            amount: Number(issue.reward_amount), // amount must be a number
            status: 'pending', // API might expect lowercase pending
            evidence: '',
            flags: { approved: false, released: false, disputed: false, resolved: false },
            receiver: contributorWallet,
          },
        ],
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

export async function releaseEscrowMilestone(repo: Repo, issue: Issue): Promise<boolean> {
  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;

  try {
    // Step 1: Approve milestone
    const approveRes = await twFetch('/escrow/multi-release/approve-milestone', {
      method: 'POST',
      body: JSON.stringify({
        approver: platformKey,
        contractId: repo.escrow_contract_id,
        milestoneIndex: String(issue.milestone_index),
      }),
    }) as { unsignedTransaction: string };

    await signAndSendTransaction(approveRes.unsignedTransaction);

    // Step 2: Release milestone
    const releaseRes = await twFetch('/escrow/multi-release/release-milestone-funds', {
      method: 'POST',
      body: JSON.stringify({
        releaseSigner: platformKey,
        contractId: repo.escrow_contract_id,
        milestoneIndex: String(issue.milestone_index),
      }),
    }) as { unsignedTransaction: string };

    await signAndSendTransaction(releaseRes.unsignedTransaction);

    console.log(`[Milestone] Released milestone ${issue.milestone_index} for issue #${issue.github_issue_number}`);
    return true;
  } catch (err) {
    console.error('[Milestone] Release failed:', err);
    return false;
  }
}
