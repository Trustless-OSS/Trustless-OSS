'use client';

import { useState } from 'react';
import { getWalletKit } from '../../lib/walletKit';

export default function CloseEscrowButton({ repoId, token }: { repoId: string, token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);

  const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

  async function handleClose() {
    setLoading(true);
    setError('');
    
    try {
      const kit = getWalletKit();
      const { address } = await kit.authModal();
      if (!address) throw new Error('No public key returned');

      const res1 = await fetch(`${BACKEND}/api/escrow/close-unsigned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repoId, maintainerWallet: address })
      });

      if (!res1.ok) throw new Error(await res1.text());
      const { unsignedTransaction } = await res1.json();

      const { signedTxXdr } = await kit.signTransaction(unsignedTransaction);

      const res2 = await fetch(`${BACKEND}/api/escrow/submit-close`, {
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
      setError(err.message || 'Closure failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {confirming ? (
        <div className="bg-red-50 border-2 border-red-600 p-3 flex flex-col gap-3 animate-in zoom-in-95">
          <p className="text-[10px] font-black text-red-600 uppercase tracking-tighter leading-tight">
            CRITICAL: This will cancel all pending milestones and refund ALL funds to your wallet. Proceed?
          </p>
          <div className="flex gap-4">
            <button 
              onClick={handleClose}
              disabled={loading}
              className="bg-red-600 text-white px-3 py-1 text-xs font-bold border-2 border-slate-950 shadow-[2px_2px_0_0_#020617] active:translate-x-0.5 active:translate-y-0.5"
            >
              {loading ? 'PROCESSING...' : 'YES_CLOSE_ALL'}
            </button>
            <button 
              onClick={() => setConfirming(false)}
              className="text-xs font-bold text-slate-500 hover:text-slate-950"
            >
              CANCEL
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setConfirming(true)}
          className="text-red-600 text-xs font-bold hover:underline underline-offset-4 decoration-2"
        >
          &gt; TERMINATE_ESCROW_REFUND_ALL
        </button>
      )}
      {error && <div className="text-red-600 text-[10px] font-bold uppercase">{error}</div>}
    </div>
  );
}
