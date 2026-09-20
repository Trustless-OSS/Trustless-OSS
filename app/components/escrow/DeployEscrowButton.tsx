'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import { getWalletKit, withTimeout, WALLET_OPERATION_TIMEOUT_MS } from '@/lib/wallet-kit';
import Button from '@/app/components/ui/Button';
import { backendUrl } from '@/lib/backend';

interface DeployEscrowButtonProps {
  repoId: string;
  token: string;
  label?: string;
  loadingLabel?: string;
  className?: string;
}

export default function DeployEscrowButton({
  repoId,
  token,
  label = 'DEPLOY ESCROW CONTRACT',
  loadingLabel = 'DEPLOYING...',
  className = '',
}: DeployEscrowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleDeploy() {
    setLoading(true);
    setError('');

    try {
      const kit = await getWalletKit();
      const { address } = await withTimeout(
        kit.authModal(),
        WALLET_OPERATION_TIMEOUT_MS,
        'Wallet authorization timed out. Please close the wallet modal and try again.'
      );
      if (!address) throw new Error('No public key returned');

      const res1 = await fetch(backendUrl('/api/v1/escrow/create-unsigned'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ repoId, maintainerWallet: address }),
      });

      if (!res1.ok) {
        const errorData = await res1.json().catch(() => null);
        throw new Error(
          errorData?.error || errorData?.message || 'Failed to create escrow transaction'
        );
      }
      const { unsignedTransaction } = await res1.json();

      const { signedTxXdr } = await withTimeout(
        kit.signTransaction(unsignedTransaction),
        WALLET_OPERATION_TIMEOUT_MS,
        'Transaction signing timed out. Please close the wallet modal and try again.'
      );
      const res2 = await fetch(backendUrl('/api/v1/escrow/submit-deploy'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ repoId, signedXdr: signedTxXdr }),
      });

      if (!res2.ok) {
        const errorData = await res2.json().catch(() => null);
        throw new Error(
          errorData?.error || errorData?.message || 'Failed to submit escrow deployment'
        );
      }
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to deploy');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-col items-stretch">
      <Button
        variant="solid"
        onClick={handleDeploy}
        disabled={loading || !token}
        className={`w-full gap-1.5 ${className}`}
      >
        <Settings
          size={17}
          strokeWidth={2.5}
          aria-hidden="true"
          className={loading ? 'animate-spin' : ''}
        />
        <span aria-live="polite">{loading ? loadingLabel : label}</span>
      </Button>
      {error && <div className="mt-2 text-left text-xs text-red-600">{error}</div>}
    </div>
  );
}
