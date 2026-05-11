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

      <div className="mt-4 flex flex-col items-end gap-2">
        <button 
          onClick={() => { setShowModal(true); setError(''); }} 
          disabled={loading}
          className="px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shadow-lg shadow-green-500/20 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 1.343-3 3s1.343 3 3 3 3 1.343 3 3-1.343 3-3 3m0-12c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4m0 12V4" />
          </svg>
          {loading ? 'Processing...' : 'Fund Escrow'}
        </button>
        {error && (
          <div className="text-red-400 text-xs mt-1 max-w-[280px] text-right bg-red-500/10 p-3 rounded-xl border border-red-500/20 backdrop-blur-md animate-in slide-in-from-top-1 duration-200">
            {error}
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0F0F0F] border border-white/10 rounded-[2rem] w-full max-w-md overflow-hidden shadow-[0_0_50px_-12px_rgba(16,185,129,0.25)] animate-in zoom-in-95 duration-300">
            <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-500 w-full" />
            
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-green-500/10 rounded-2xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white leading-none mb-1">Fund Escrow</h3>
                  <p className="text-gray-500 text-sm">Add liquidity to your bounty pool</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="relative group">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 ml-1">Deposit Amount</label>
                  <div className="relative">
                    <input 
                      type="number"
                      autoFocus
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={`w-full bg-white/5 border ${Number(amount) <= 0 ? 'border-red-500/50 focus:ring-red-500/20' : 'border-white/10 focus:ring-green-500/20'} rounded-2xl px-6 py-5 text-white focus:outline-none focus:ring-4 transition-all text-2xl font-mono`}
                      placeholder="0.00"
                    />
                    <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <span className="w-px h-8 bg-white/10 mx-2" />
                      <span className="text-green-500 font-black text-sm tracking-tighter">USDC</span>
                    </div>
                  </div>
                  {Number(amount) <= 0 && (
                    <p className="text-red-500/80 text-[10px] mt-2 ml-1 font-medium animate-pulse">Amount must be greater than 0</p>
                  )}
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowModal(false)}
                    className="flex-1 py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold transition-all border border-white/5"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleFund}
                    disabled={Number(amount) <= 0}
                    className="flex-[1.5] py-4 px-6 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold transition-all shadow-xl shadow-green-600/20 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                  >
                    Confirm & Sign
                  </button>
                </div>
              </div>
              
              <p className="text-center text-[10px] text-gray-600 mt-8 uppercase tracking-widest font-bold">
                Securely signed via Stellar Wallets Kit
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
