'use client';

import { useState } from 'react';
import { getWalletKit } from '../../lib/walletKit';

export default function WithdrawEscrowButton({ repoId, token, currentBalance }: { repoId: string, token: string, currentBalance: number }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [amount, setAmount] = useState('');
  const [showInput, setShowInput] = useState(false);

  const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

  async function handleWithdraw() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Enter valid amount');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      const kit = getWalletKit();
      const { address } = await kit.authModal();
      if (!address) throw new Error('No public key returned');

      const res1 = await fetch(`${BACKEND}/api/escrow/withdraw-unsigned`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repoId, amount: Number(amount), maintainerWallet: address })
      });

      if (!res1.ok) throw new Error(await res1.text());
      const { unsignedTransaction } = await res1.json();

      const { signedTxXdr } = await kit.signTransaction(unsignedTransaction);

      const res2 = await fetch(`${BACKEND}/api/escrow/submit-withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repoId, amount: Number(amount), signedXdr: signedTxXdr })
      });

      if (!res2.ok) throw new Error(await res2.text());
      window.location.reload(); 
    } catch (err: any) {
      setError(err.message || 'Withdraw failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      {showInput ? (
        <div className="flex gap-2 animate-in fade-in slide-in-from-right-4">
          <input 
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="bg-white border-2 border-slate-950 px-2 py-1 text-sm w-24 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button 
            onClick={handleWithdraw}
            disabled={loading}
            className="brutal-button px-3 py-1 text-xs"
          >
            {loading ? '...' : 'CONFIRM'}
          </button>
          <button 
            onClick={() => setShowInput(false)}
            className="text-xs font-bold text-slate-500 hover:text-slate-950"
          >
            CANCEL
          </button>
        </div>
      ) : (
        <button 
          onClick={() => setShowInput(true)}
          className="brutal-button-outline px-4 py-2 text-xs"
        >
          WITHDRAW_FUNDS
        </button>
      )}
      {error && <div className="text-red-600 text-[10px] font-bold uppercase">{error}</div>}
    </div>
  );
}
