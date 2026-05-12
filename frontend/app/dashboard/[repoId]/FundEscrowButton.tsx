'use client';

import { useState } from 'react';
import { getWalletKit } from '../../lib/walletKit';

export default function FundEscrowButton({ repoId, token }: { repoId: string, token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [amount, setAmount] = useState('0');

  const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

  async function handleFund() {
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    setLoading(true);
    setError('');
    setShowModal(false);
    
    try {
      const kit = getWalletKit();
      
      // 1. Open wallet kit modal and get address
      const { address } = await kit.authModal();
      if (!address) throw new Error('No public key returned');

      // 2. Get unsigned transaction
      const res1 = await fetch(`${BACKEND}/api/escrow/fund-unsigned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          repoId,
          amount: numAmount,
          funderWallet: address
        })
      });

      if (!res1.ok) {
        const errData = await res1.json();
        if (errData.message?.includes('insufficient funds')) {
          throw new Error('Insufficient funds in your wallet to cover the escrow + gas.');
        }
        throw new Error(errData.message || 'Failed to generate funding transaction');
      }
      
      const { unsignedTransaction } = await res1.json();

      // 3. Sign transaction
      const { signedTxXdr } = await kit.signTransaction(unsignedTransaction);

      // 4. Submit signed transaction
      const res2 = await fetch(`${BACKEND}/api/escrow/submit-fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repoId, amount: numAmount, signedXdr: signedTxXdr })
      });

      if (!res2.ok) {
        const errData = await res2.json();
        throw new Error(errData.message || 'Failed to submit funding transaction');
      }

      window.location.reload(); 
    } catch (err: any) {
      setError(err.message || 'Failed to fund');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style jsx global>{`
        input[type='number']::-webkit-inner-spin-button,
        input[type='number']::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type='number'] {
          -moz-appearance: textfield;
        }
      `}</style>

      <button 
        onClick={() => { setShowModal(true); setError(''); }} 
        disabled={loading}
        className="brutal-button px-5 py-3 text-sm flex items-center gap-2"
      >
        {loading ? 'PROCESSING...' : 'FUND_ESCROW'}
      </button>
      {error && (
        <div className="absolute right-0 top-full z-10 text-red-600 font-bold font-mono text-xs mt-2 max-w-[280px] text-right bg-white p-2 border-2 border-slate-950 shadow-[4px_4px_0_0_#ef4444]">
          {error}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-white border-[6px] border-slate-950 w-full max-w-md shadow-[16px_16px_0px_0px_#2563eb]">
            <div className="h-4 bg-blue-600 border-b-4 border-slate-950 w-full" />
            
            <div className="p-8">
              <div className="mb-8">
                <div className="label-brutal bg-slate-950 text-white px-3 py-1 w-fit mb-4">ACTION // ADD_LIQUIDITY</div>
                <h3 className="title-brutal text-3xl text-slate-950 mb-1">FUND_ESCROW</h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="label-brutal text-slate-500 block mb-3">DEPOSIT_AMOUNT</label>
                  <div className="relative">
                    <input 
                      type="number"
                      autoFocus
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={`w-full bg-slate-100 border-[4px] ${Number(amount) <= 0 ? 'border-red-500' : 'border-slate-950'} px-6 py-5 text-slate-950 focus:outline-none focus:border-blue-600 transition-all text-3xl font-black font-mono`}
                      placeholder="0.00"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-4">
                      <div className="w-1 h-8 bg-slate-950" />
                      <span className="text-blue-600 font-black text-lg tracking-tighter">USDC</span>
                    </div>
                  </div>
                  {Number(amount) <= 0 && (
                    <p className="text-red-600 text-xs mt-2 font-bold uppercase tracking-widest font-mono">ERR_INVALID_AMOUNT: &gt; 0 REQUIRED</p>
                  )}
                </div>

                <div className="flex gap-4 mt-8 pt-8 border-t-4 border-slate-950 border-dashed">
                  <button 
                    onClick={() => setShowModal(false)}
                    className="brutal-button-outline py-4 px-6 flex-1 text-sm"
                  >
                    ABORT
                  </button>
                  <button 
                    onClick={handleFund}
                    disabled={Number(amount) <= 0}
                    className="brutal-button py-4 px-6 flex-[1.5] text-sm disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    SIGN_TX
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
