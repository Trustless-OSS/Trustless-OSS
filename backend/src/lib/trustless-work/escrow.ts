import { twFetch } from './client.js';
import { signAndSendTransaction } from '../stellar/signer.js';

// Testnet USDC issuer
const TESTNET_USDC = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

export async function createRepoEscrow(params: {
  maintainerWallet: string;
  repoName: string;
}): Promise<{ contractId: string }> {
  const platformKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY!;

  const response = await twFetch('/escrow/multi-release/deploy', {
    method: 'POST',
    body: JSON.stringify({
      signer: params.maintainerWallet,
      engagementId: `repo-${Date.now()}`,
      title: `OSS Bounty: ${params.repoName}`,
      description: `Escrow for OSS bounty rewards in ${params.repoName}`,
      roles: {
        approver: params.maintainerWallet,
        serviceProvider: platformKey,
        platformAddress: platformKey,
        releaseSigner: platformKey,
        disputeResolver: params.maintainerWallet,
        receiver: platformKey, // placeholder — overridden per milestone
      },
      platformFee: 0,
      milestones: [],
      trustline: {
        address: TESTNET_USDC,
      },
    }),
  }) as { unsignedTransaction: string };

  const result = await signAndSendTransaction(response.unsignedTransaction) as { contractId: string };
  return { contractId: result.contractId };
}

export async function getEscrowState(contractId: string): Promise<unknown> {
  return twFetch(`/escrow/${contractId}`);
}
