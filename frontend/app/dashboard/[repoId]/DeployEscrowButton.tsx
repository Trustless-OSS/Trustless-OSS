'use client';

import { useState } from 'react';

export default function DeployEscrowButton({ repoId, token }: { repoId: string, token: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

  async function handleDeploy() {
    setLoading(true);
    setError('');
    
    // In a real app, you might ask for the maintainer's wallet first.
    // Here we'll just pass a dummy one or use the platform wallet for demo.
    try {
      const res = await fetch(`${BACKEND}/api/escrow/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          repoId,
          maintainerWallet: 'GCJGOM2HPJGHEAGVFGIFN7SVTGWOZIH27E7JL7Q4D4VVIC4NZ7UK2VRK' // placeholder testnet wallet
        })
      });

      if (!res.ok) {
        const text = await res.text();
        setError(text);
      } else {
        window.location.reload(); // Refresh to see the new escrow
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-2">
      <button 
        onClick={handleDeploy} 
        disabled={loading}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
      >
        {loading ? 'Deploying...' : 'Deploy Escrow Contract'}
      </button>
      {error && <div className="text-red-400 text-xs mt-2">{error}</div>}
    </div>
  );
}
