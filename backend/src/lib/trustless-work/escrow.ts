import { twFetch } from './client.js';
import { signAndSendTransaction } from '../stellar/signer.js';

// Testnet USDC issuer
const TESTNET_USDC = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export async function createRepoEscrow(params: {
  maintainerWallet: string;
  repoName: string;
}): Promise<{ contractId: string }> {
  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;
  const resolverKey = process.env.RESOLVER_STELLAR_PUBLIC_KEY;

  const response = await twFetch('/deployer/multi-release', {
    method: 'POST',
    body: JSON.stringify({
      signer: params.maintainerWallet,
      engagementId: `repo-${Date.now()}`,
      title: `OSS Bounty: ${params.repoName}`,
      description: `Escrow for OSS bounty rewards in ${params.repoName}`,
      roles: {
        approver: platformKey, // platform auto-approves on PR merge
        serviceProvider: platformKey,
        platformAddress: platformKey,
        releaseSigner: platformKey,
        disputeResolver: resolverKey, // Use dedicated resolver wallet if available
      },
      platformFee: 0,
      milestones: [
        {
          description: `Initial Escrow Setup`,
          amount: 0.001, // Minimum amount required to satisfy contract checks
          receiver: platformKey, // Placeholder receiver
        }
      ],
      trustline: {
        address: TESTNET_USDC,
        symbol: 'USDC',
      },
    }),
  }) as { unsignedTransaction: string };

  const result = await signAndSendTransaction(response.unsignedTransaction) as { contractId: string };
  return { contractId: result.contractId };
}

export async function getEscrowState(contractId: string): Promise<unknown> {
  return twFetch(`/escrow/${contractId}`);
}

export async function fundEscrow(params: {
  contractId: string;
  amount: number;
  funderWallet: string;
}): Promise<void> {
  const response = await twFetch('/escrow/multi-release/fund-escrow', {
    method: 'POST',
    body: JSON.stringify({
      contractId: params.contractId,
      signer: params.funderWallet,
      amount: params.amount,
    }),
  }) as { unsignedTransaction: string };

  await signAndSendTransaction(response.unsignedTransaction);
}
