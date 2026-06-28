import { Job } from 'bullmq';
import { supabase } from './supabase.js';
import { twFetch } from './trustless-work/client.js';
import { logger } from './logger.js';
import {
  handleIssueLabeled,
  handleIssueAssigned,
  handleIssueUnassigned,
  handleIssueClosed,
  handleIssueCommentCreated,
  handlePRMerged,
  handleInstallation,
  handleInstallationRepositories,
} from './github/webhook.js';

const log = logger.child({ module: 'queue-processors' });

export async function processWebhookJob(job: Job): Promise<void> {
  const { event, action, payload } = job.data;

  log.info(`[Worker:webhooks] Processing job ${job.id} for event ${event}.${action ?? ''}`);

  if (event === 'issues') {
    if (action === 'opened' || action === 'labeled') await handleIssueLabeled(payload);
    else if (action === 'assigned') await handleIssueAssigned(payload);
    else if (action === 'unassigned') await handleIssueUnassigned(payload);
    else if (action === 'closed') await handleIssueClosed(payload);
  }

  if (event === 'issue_comment' && action === 'created') {
    await handleIssueCommentCreated(payload);
  }

  if (event === 'pull_request' && action === 'closed') {
    const pr = payload.pull_request as { merged: boolean } | undefined;
    if (pr?.merged) {
      await handlePRMerged(payload);
    }
  }

  if (event === 'installation') {
    await handleInstallation(payload);
  }

  if (event === 'installation_repositories') {
    await handleInstallationRepositories(payload);
  }
}

export async function syncAllEscrowBalances(): Promise<void> {
  log.info('Starting escrow balance sync for all active repositories...');

  const { data: repos, error } = await supabase
    .from('repos')
    .select('id, full_name, escrow_contract_id, escrow_balance')
    .not('escrow_contract_id', 'is', null);

  if (error) {
    log.error({ err: error }, 'failed to fetch repos for balance sync');
    throw error;
  }

  if (!repos || repos.length === 0) {
    log.info('No active escrows found to sync.');
    return;
  }

  log.info({ count: repos.length }, 'found active repositories with escrows');

  try {
    // Build query parts for batch contract ID query
    const queryParts = repos
      .filter((r): r is typeof r & { escrow_contract_id: string } => !!r.escrow_contract_id)
      .map((r) => `contractIds[]=${r.escrow_contract_id}`)
      .join('&');

    if (!queryParts) {
      log.info('No valid contract IDs to query.');
      return;
    }

    const escrows = (await twFetch(`/helper/get-escrow-by-contract-ids?${queryParts}`)) as any[];

    const escrowMap = new Map<string, number>();
    for (const escrow of escrows) {
      if (escrow && escrow.contractId) {
        escrowMap.set(escrow.contractId, Number(escrow.balance ?? 0));
      }
    }

    for (const repo of repos) {
      if (!repo.escrow_contract_id) continue;

      const onChainBalance = escrowMap.get(repo.escrow_contract_id);
      if (onChainBalance === undefined) {
        log.warn(
          { repo: repo.full_name, contractId: repo.escrow_contract_id },
          'escrow contract not found on-chain'
        );
        continue;
      }

      if (onChainBalance !== repo.escrow_balance) {
        log.info(
          { repo: repo.full_name, prev: repo.escrow_balance, next: onChainBalance },
          'syncing escrow balance from cron'
        );
        const { error: updateErr } = await supabase
          .from('repos')
          .update({ escrow_balance: onChainBalance })
          .eq('id', repo.id);

        if (updateErr) {
          log.error(
            { err: updateErr, repo: repo.full_name },
            'failed to update repo escrow balance in DB'
          );
        }
      }
    }
  } catch (err: any) {
    log.error({ err }, 'failed during batch escrow balance sync');
    throw err;
  }
}
