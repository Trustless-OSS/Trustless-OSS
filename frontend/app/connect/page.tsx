'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000';

function ConnectForm() {
  const searchParams = useSearchParams();
  const issueId = searchParams.get('issue');
  const repoId = searchParams.get('repo');

  const [wallet, setWallet] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    if (!wallet.startsWith('G') || wallet.length < 50) {
      setError('Enter a valid Stellar wallet address (starts with G)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) { window.location.href = `/login?next=/connect?issue=${issueId}&repo=${repoId}`; return; }

      // Save wallet + push milestone on-chain
      const res = await fetch(`${BACKEND}/api/milestones/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          githubIssueId: Number(issueId),
          githubRepoId: Number(repoId),
          wallet,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to connect wallet');
        return;
      }

      setDone(true);
    } catch (e) {
      setError('Unexpected error. Please try again.');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-white mb-3">Wallet connected!</h2>
        <p className="text-gray-400 mb-6">
          Your bounty is locked in escrow! You will receive a confirmation comment on your GitHub issue shortly.
        </p>
        <button 
          onClick={() => window.close()} 
          className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors text-sm"
        >
          Close window & Return to GitHub
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="text-4xl mb-4">🚀</div>
      <h1 className="text-2xl font-extrabold text-white mb-2">Claim your bounty</h1>
      <p className="text-gray-400 text-sm mb-8 leading-relaxed">
        Connect your Stellar wallet to receive USDC when your PR is merged.
      </p>

      <label className="block text-sm text-gray-400 mb-2">Stellar Wallet Address</label>
      <input
        id="stellar-wallet-input"
        type="text"
        placeholder="G... (56 characters)"
        value={wallet}
        onChange={(e) => setWallet(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-4 font-mono text-sm"
      />

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        id="connect-wallet-btn"
        onClick={handleSubmit}
        disabled={loading || !wallet}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold transition-all"
      >
        {loading ? 'Connecting…' : 'Connect wallet & lock bounty →'}
      </button>

      <p className="text-xs text-gray-600 mt-4 text-center">
        Don't have a Stellar wallet?{' '}
        <a href="https://lobstr.co" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">
          Get one free at LOBSTR
        </a>
      </p>
    </>
  );
}

export default function ConnectPage() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="relative w-full max-w-md">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl blur opacity-20" />
        <div className="relative glass rounded-2xl p-10 text-center">
          <Suspense fallback={<div className="text-gray-400 text-sm">Loading…</div>}>
            <ConnectForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
