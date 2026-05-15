'use client';

import { useState } from 'react';
import { getWalletKit } from '../../lib/walletKit';

export default function DeployEscrowButton({ repoId, token }: { repoId: string, token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

  async function handleDeploy() {
    setLoading(true);
    setError('');
    
    try {
      const kit = getWalletKit();

      // 1. Open modal and get address
      const { address } = await kit.authModal();
      if (!address) throw new Error('No public key returned');

      // 2. Get unsigned transaction
      const res1 = await fetch(`${BACKEND}/api/escrow/create-unsigned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repoId, maintainerWallet: address })
      });

      if (!res1.ok) throw new Error(await res1.text());
      const { unsignedTransaction } = await res1.json();

      // 3. Sign transaction
      const { signedTxXdr } = await kit.signTransaction(unsignedTransaction);

      // 4. Submit signed transaction
      const res2 = await fetch(`${BACKEND}/api/escrow/submit-deploy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repoId, signedXdr: signedTxXdr })
      });

      if (!res2.ok) throw new Error(await res2.text());
      window.location.reload(); 
    } catch (err: any) {
      setError(err.message || 'Failed to deploy');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2 flex flex-col items-start">
      <button 
        onClick={handleDeploy} 
        disabled={loading}
        className="brutal-button px-4 py-2 text-sm"
      >
        {loading ? 'Deploying...' : 'Deploy Escrow Contract'}
      </button>
      {error && <div className="text-red-400 text-xs mt-2 max-w-[200px] text-left">{error}</div>}
    </div>
  );
}
