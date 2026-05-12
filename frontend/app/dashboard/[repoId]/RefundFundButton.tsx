'use client';

import { useState } from 'react';
import { getWalletKit } from '../../lib/walletKit';

export default function RefundFundButton({ repoId, token, currentBalance }: { repoId: string, token: string, currentBalance: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);

  const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

  async function handleRefund() {
    if (currentBalance <= 0) {
      setError('NO_FUNDS_AVAILABLE_FOR_REFUND');
      return;
    }
    
    setLoading(true);
    setError('');
    setShowModal(false);
    
    try {
      const kit = getWalletKit();
      const { address } = await kit.authModal();
      if (!address) throw new Error('No public key returned');

      // 1. Get unsigned transaction for full sweep
      const res1 = await fetch(`${BACKEND}/api/escrow/withdraw-unsigned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repoId, maintainerWallet: address })
      });

      if (!res1.ok) {
        const errData = await res1.json();
        const msg = errData.error || JSON.stringify(errData);
        const match = msg.match(/→ \d+: ({.*})/);
        if (match) {
          const inner = JSON.parse(match[1]);
          throw new Error(inner.message || inner.error || 'Blockchain operation failed');
        }
        throw new Error(msg);
      }
      
      const { unsignedTransaction } = await res1.json();

      // 2. Sign transaction
      const { signedTxXdr } = await kit.signTransaction(unsignedTransaction);

      // 3. Submit signed transaction
      const res2 = await fetch(`${BACKEND}/api/escrow/submit-withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repoId, signedXdr: signedTxXdr })
      });

      if (!res2.ok) {
        const errData = await res2.json();
        throw new Error(errData.error || 'Transaction submission failed');
      }

      window.location.reload(); 
    } catch (err: any) {
      console.error('[Refund] Error:', err);
      let friendlyMsg = err.message;
      if (friendlyMsg.includes('Failed to fetch')) friendlyMsg = 'NETWORK_ERROR: CANNOT_REACH_SERVER';
      setError(friendlyMsg.toUpperCase());
      setShowModal(true); // Ensure modal stays open to show the error
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button 
        onClick={() => { setShowModal(true); setError(''); }} 
        disabled={loading || currentBalance <= 0}
        className="brutal-button-outline px-5 py-3 text-sm flex items-center gap-2 w-full sm:w-auto disabled:opacity-50 disabled:grayscale"
      >
        {loading ? 'PROCESSING...' : 'REFUND_FUNDS'}
      </button>

      {error && (
        <div className="absolute right-0 top-full z-10 text-red-600 font-bold font-mono text-[10px] mt-2 max-w-[280px] text-right bg-white p-2 border-2 border-slate-950 shadow-[4px_4px_0_0_#ef4444] uppercase">
          {error}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white border-[6px] border-slate-950 w-full max-w-md shadow-[16px_16px_0px_0px_#ef4444]">
            <div className="h-4 bg-red-600 border-b-4 border-slate-950 w-full" />
            
            <div className="p-8">
              <div className="mb-8">
                <div className="label-brutal bg-slate-950 text-white px-3 py-1 w-fit mb-4">ACTION // SWEEP_LIQUIDITY</div>
                <h3 className="title-brutal text-3xl text-slate-950 mb-1">REFUND_ALL_FUNDS</h3>
                {error && (
                  <div className="bg-red-50 border-l-8 border-red-600 p-4 mt-6 animate-in slide-in-from-top-2">
                    <p className="text-red-600 font-black text-xs uppercase mb-1">ERR_PROTOCOL_REJECTION</p>
                    <p className="text-red-950 font-mono text-[10px] font-bold leading-tight uppercase">{error}</p>
                  </div>
                )}
                <div className="mt-6 p-4 bg-slate-100 border-2 border-slate-950 font-mono">
                  <p className="text-slate-500 text-[10px] font-bold uppercase mb-2">Refundable Balance</p>
                  <p className="text-3xl font-black text-slate-950">{currentBalance.toFixed(2)} <span className="text-sm">USDC</span></p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="p-4 bg-red-50 border-2 border-red-600 text-red-600 text-[10px] font-bold uppercase leading-relaxed">
                  Warning: This will pull all available USDC from the escrow contract back to your wallet. Funds locked in active milestones will remain in the contract.
                </div>

                <div className="flex gap-4 mt-8 pt-8 border-t-4 border-slate-950 border-dashed">
                  <button 
                    onClick={() => setShowModal(false)}
                    className="brutal-button-outline py-4 px-6 flex-1 text-sm"
                  >
                    ABORT
                  </button>
                  <button 
                    onClick={handleRefund}
                    className="bg-red-600 text-white px-6 py-4 flex-[1.5] text-sm font-bold border-4 border-slate-950 shadow-[4px_4px_0_0_#020617] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase"
                  >
                    SIGN_SWEEP_TX
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
