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
        <div className="label-brutal bg-blue-600 text-white mb-6 w-fit mx-auto border-2 border-slate-950 px-3 py-1">
          SYS_STATUS // SUCCESS
        </div>
        <div className="text-6xl mb-6">✅</div>
        <h2 className="title-brutal text-3xl text-slate-950 mb-4">WALLET_LINKED</h2>
        <div className="terminal-block text-left text-sm">
          <span className="text-blue-400">log:</span> Payout wallet mapped to issue registry.<br />
          <span className="text-blue-400">log:</span> You may close this window and merge PR.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="label-brutal bg-slate-950 text-white mb-6 w-fit border-2 border-slate-950 px-3 py-1">
        SYS_ACTION // CLAIM_BOUNTY
      </div>
      <div className="text-6xl mb-6 grayscale text-center">🚀</div>
      <h1 className="title-brutal text-3xl text-slate-950 mb-2 text-center">INITIALIZE_PAYOUT</h1>
      
      <div className="terminal-block text-left text-sm mb-8 mt-6">
        <span className="text-slate-500">// Connect Stellar wallet to receive USDC</span><br />
        <span className="text-slate-500">// Funds will be released upon PR merge</span>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-100 border-[4px] border-slate-950 shadow-[4px_4px_0_0_#ef4444] text-red-600 font-bold font-mono text-sm uppercase">
          ERR: {error}
        </div>
      )}

      <button
        id="connect-wallet-btn"
        onClick={handleConnect}
        disabled={loading}
        className="brutal-button w-full py-4 text-lg"
      >
        {loading ? 'CONNECTING...' : 'CONNECT_WALLET'}
      </button>

      <div className="mt-8 pt-6 border-t-[4px] border-slate-950 border-dashed text-center">
        <p className="text-xs text-slate-600 font-mono font-bold uppercase">
          Don't have a wallet?{' '}
          <a href="https://lobstr.co" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:bg-blue-600 hover:text-white transition-colors border-b-2 border-blue-600">
            GET_LOBSTR
          </a>
        </p>
      </div>
    </>
  );
}

export default function ConnectPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white brutal-border p-8 md:p-12 brutal-shadow relative">
        <div className="absolute top-0 left-0 w-8 h-8 bg-blue-600 border-b-4 border-r-4 border-slate-950"></div>
        <Suspense fallback={<div className="font-mono font-bold text-sm uppercase text-slate-500 animate-pulse">LOADING_MODULE...</div>}>
          <ConnectForm />
        </Suspense>
      </div>
    </div>
  );
}
