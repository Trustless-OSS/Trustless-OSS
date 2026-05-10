'use client';

import { useState } from 'react';

export default function FundEscrowButton({ repoId, token }: { repoId: string, token: string }) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('100');
  const [error, setError] = useState('');

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

  async function handleFund() {
    setLoading(true);
    setError('');
    
    try {
      const res = await fetch(`${BACKEND}/api/escrow/fund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          repoId,
          amount: Number(amount),
          funderWallet: 'GCJGOM2HPJGHEAGVFGIFN7SVTGWOZIH27E7JL7Q4D4VVIC4NZ7UK2VRK' // placeholder testnet wallet
        })
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text);
      } else {
        window.location.reload(); // Refresh to see the new balance
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <input 
          type="number" 
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-20 px-2 py-1 bg-gray-800 border border-gray-700 rounded text-sm text-white"
          placeholder="Amount"
        />
        <button 
          onClick={handleFund} 
          disabled={loading}
          className="px-3 py-1 bg-green-600 hover:bg-green-500 rounded text-xs font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? 'Funding...' : 'Fund Escrow'}
        </button>
      </div>
      {error && <div className="text-red-400 text-xs">{error}</div>}
    </div>
  );
}
