'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';
import { getWalletKit } from '../lib/walletKit';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

function ConnectForm() {
  const searchParams = useSearchParams();
  const issueId = searchParams.get('issue');
  const repoId = searchParams.get('repo');

  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect() {
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) { 
        window.location.href = `/login?next=/connect?issue=${issueId}&repo=${repoId}`; 
        return; 
      }

      const kit = getWalletKit();
      
      const { address } = await kit.authModal();
      if (!address) throw new Error('No public key returned');

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
          wallet: address,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to connect wallet');
      }

      setDone(true);
    } catch (e: any) {
      setError(e.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Wallet Connected!</h2>
        <p className="text-gray-400">
          Your payout wallet is ready. You can close this page and get back to coding!
        </p>
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

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <button
        id="connect-wallet-btn"
        onClick={handleConnect}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            Connecting...
          </>
        ) : (
          'Connect Wallet'
        )}
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
