import { twFetch } from './client.js';
import { signAndSendTransaction } from '../stellar/signer.js';
import { supabase } from '../supabase.js';
import type { Repo, Issue } from '../../types/index.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'milestone' });

function decodeBase58(str: string): Buffer {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const ALPHABET_MAP: Record<string, number> = {};
  for (let i = 0; i < ALPHABET.length; i++) {
    ALPHABET_MAP[ALPHABET.charAt(i)] = i;
  }
  const bytes = [0];
  for (let i = 0; i < str.length; i++) {
    const c = str.charAt(i);
    if (!(c in ALPHABET_MAP)) throw new Error('Non-base58 character');
    let carry = ALPHABET_MAP[c];
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str.charAt(i) === '1'; i++) {
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}

export async function pushMilestoneOnChain(
  repo: Repo,
  issue: Issue,
  payoutAddress: string,
  payoutChain: string = 'stellar'
): Promise<void> {
  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;

  // Fetch current escrow state to determine the next milestone index
  const escrowArray = (await twFetch(
    `/helper/get-escrow-by-contract-ids?contractIds[]=${repo.escrow_contract_id}`
  )) as Array<{
    milestones: unknown[];
    [key: string]: unknown;
  }>;
  const escrowData = escrowArray[0];

  if (!escrowData) {
    throw new Error(`Escrow not found: ${repo.escrow_contract_id}`);
  }

  const currentMilestones = (escrowData.milestones ?? []) as any[];
  let milestoneIndex = issue.milestone_index;
  const newMilestones = [...currentMilestones];

  let receiver: any;
  if (payoutChain === 'stellar') {
    receiver = {
      payout_type: 0,
      stellar_address: payoutAddress,
      destination_domain: 0,
      recipient: '0000000000000000000000000000000000000000000000000000000000000000',
    };
  } else {
    let destinationDomain = 0;
    if (payoutChain === 'base') {
      destinationDomain = 6;
    } else if (payoutChain === 'ethereum') {
      destinationDomain = 0;
    } else if (payoutChain === 'solana') {
      destinationDomain = 5;
    }

    let recipientHex = '';
    try {
      if (payoutChain === 'solana') {
        recipientHex = decodeBase58(payoutAddress).toString('hex').padStart(64, '0');
      } else {
        const clean = payoutAddress.startsWith('0x') ? payoutAddress.slice(2) : payoutAddress;
        recipientHex = clean.toLowerCase().padStart(64, '0');
      }
    } catch (e) {
      log.error({ err: e }, 'Failed to decode payout address');
      throw e;
    }

    receiver = {
      payout_type: 1,
      stellar_address: null,
      destination_domain: destinationDomain,
      recipient: recipientHex,
    };
  }

  const milestoneData = {
    description: `Issue #${issue.github_issue_number}: ${issue.title}`,
    amount: Number(issue.reward_amount),
    status: 'pending',
    evidence: '',
    flags: { approved: false, released: false, disputed: false, resolved: false },
    receiver,
  };

  if (milestoneIndex !== null && milestoneIndex < currentMilestones.length) {
    newMilestones[milestoneIndex] = milestoneData;
  } else {
    milestoneIndex = currentMilestones.length;
    newMilestones.push(milestoneData);
  }

  const {
    type: _type,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    balance: _balance,
    inconsistencies: _inconsistencies,
    contractBaseId: _contractBaseId,
    isActive: _isActive,
    receiverMemo: _receiverMemo,
    ...escrowPayload
  } = escrowData as any;

  const updateRes = (await twFetch('/escrow/multi-release/update-escrow', {
    method: 'PUT',
    body: JSON.stringify({
      signer: platformKey,
      contractId: repo.escrow_contract_id,
      escrow: {
        ...escrowPayload,
        milestones: newMilestones,
      },
    }),
  })) as { unsignedTransaction: string };

  await signAndSendTransaction(updateRes.unsignedTransaction);

  // Update issue in DB with on-chain milestone index
  await supabase
    .from('issues')
    .update({ milestone_index: milestoneIndex, status: 'active' })
    .eq('id', issue.id);

  log.info({ issue: issue.github_issue_number, milestoneIndex }, 'issue pushed on-chain');
}

export async function releaseEscrowMilestone(repo: Repo, issue: Issue): Promise<string> {
  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;

  if (issue.milestone_index === null) {
    throw new Error(
      `milestone_index is null for issue #${issue.github_issue_number} — was pushMilestoneOnChain called?`
    );
  }

  // Step 1: Approve milestone (platformKey must be the escrow approver role)
  try {
    const approveRes = (await twFetch('/escrow/multi-release/approve-milestone', {
      method: 'POST',
      body: JSON.stringify({
        approver: platformKey,
        contractId: repo.escrow_contract_id,
        milestoneIndex: String(issue.milestone_index),
      }),
    })) as { unsignedTransaction: string };

    await signAndSendTransaction(approveRes.unsignedTransaction);
  } catch (err: any) {
    // If it's already approved, we can safely proceed to release
    const isAlreadyApproved = err.message.includes('already been approved previously');
    if (isAlreadyApproved) {
      log.info(
        { milestoneIndex: issue.milestone_index },
        'milestone already approved, skipping approval step'
      );
    } else {
      throw err;
    }
  }

  // Step 2: Release milestone funds
  try {
    const releaseRes = (await twFetch('/escrow/multi-release/release-milestone-funds', {
      method: 'POST',
      body: JSON.stringify({
        releaseSigner: platformKey,
        contractId: repo.escrow_contract_id,
        milestoneIndex: String(issue.milestone_index),
      }),
    })) as { unsignedTransaction: string };

    const result = (await signAndSendTransaction(releaseRes.unsignedTransaction)) as {
      hash?: string;
      transactionHash?: string;
    };
    const hash = result.hash || result.transactionHash;

    log.info(
      { milestoneIndex: issue.milestone_index, issue: issue.github_issue_number, hash },
      'milestone released'
    );
    return hash ?? 'success';
  } catch (err: any) {
    // If it's already released, we are done
    const isAlreadyReleased =
      err.message.includes('already been released previously') ||
      err.message.includes('already been paid');
    if (isAlreadyReleased) {
      log.info(
        { milestoneIndex: issue.milestone_index },
        'milestone already released, returning success'
      );
      return 'success';
    }

    // Special case: 0-amount milestones sometimes fail with dispute errors or other contract restrictions
    // Since there's no actual value to transfer, we can safely treat it as a database-only completion
    const isDisputeError = err.message.includes(
      'Only the dispute resolver can execute this function'
    );
    if (isDisputeError && Number(issue.reward_amount) === 0) {
      log.info(
        { milestoneIndex: issue.milestone_index },
        '0-amount milestone encountered contract restriction — marking as success locally'
      );
      return 'success';
    }

    throw err;
  }
}
