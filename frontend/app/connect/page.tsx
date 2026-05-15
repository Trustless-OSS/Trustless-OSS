'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';
import { getWalletKit } from '../lib/walletKit';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { handleError, notifySuccess } from '@/lib/notifications';

const BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(/\/$/, '');

function ConnectForm() {
  const searchParams = useSearchParams();
  const issueId = searchParams.get('issue');
  const repoId = searchParams.get('repo');

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [isAssigned, setIsAssigned] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [redirectUrl, setRedirectUrl] = useState('');

  useEffect(() => {
    async function checkAccess() {
      if (!issueId || !repoId) {
        setChecking(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = `/login?next=/connect?issue=${issueId}&repo=${repoId}`;
          return;
        }

        const res = await fetch(`${BACKEND}/api/contributor/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const { contributor } = await res.json();
          const match = contributor?.assignments?.some((a: any) => 
            String(a.issues?.github_issue_id) === String(issueId)
          );
          setIsAssigned(!!match);
        }
      } catch (e) {
        console.error('Failed to check assignment:', e);
      } finally {
        setChecking(false);
      }
    }
    checkAccess();
  }, [issueId, repoId]);

  useEffect(() => {
    if (done && redirectUrl && countdown > 0) {
      const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (done && redirectUrl && countdown === 0) {
      window.location.href = redirectUrl;
    }
  }, [done, redirectUrl, countdown]);

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

      const { repoFullName, issueNumber } = await res.json();
      setRedirectUrl(`https://github.com/${repoFullName}/issues/${issueNumber}`);
      
      notifySuccess('Wallet Connected', 'Your payout address has been successfully linked to this issue.');
      setDone(true);
    } catch (e: any) {
      handleError(e, 'Connect Wallet');
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
        <div className="text-6xl mb-6 animate-bounce">✅</div>
        <h2 className="title-brutal text-3xl text-slate-950 mb-4">WALLET_LINKED</h2>
        
        <div className="terminal-block text-left text-sm mb-8">
          <span className="text-blue-400">log:</span> Payout wallet mapped to issue registry.<br />
          <span className="text-blue-400">log:</span> You may close this window or wait.<br />
          <div className="mt-4 pt-4 border-t border-blue-900/30 flex items-center justify-between">
            <span className="text-blue-400">status:</span>
            <span className="bg-blue-600 text-white px-2 py-0.5 font-bold animate-pulse">
              REDIRECTING_IN_{countdown}s...
            </span>
          </div>
        </div>

        <a 
          href={redirectUrl}
          className="text-xs font-mono font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase underline underline-offset-4"
        >
          Click here if not redirected automatically
        </a>
      </div>
    );
  }

  return (
    <>
      <div className="label-brutal bg-slate-950 text-white mb-6 w-fit border-2 border-slate-950 px-3 py-1">
        SYS_ACTION // CLAIM_BOUNTY
      </div>

      {checking ? (
        <div className="text-center py-8">
          <div className="w-12 h-12 border-4 border-slate-950 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="font-mono text-xs uppercase font-bold text-slate-500">Verifying Identity...</p>
        </div>
      ) : !isAssigned ? (
        <div className="text-center">
          <div className="text-6xl mb-6 grayscale">🚫</div>
          <h2 className="title-brutal text-2xl text-slate-950 mb-4">ACCESS_DENIED</h2>
          <div className="p-4 bg-red-100 border-[4px] border-slate-950 shadow-[4px_4px_0_0_#000] text-red-600 font-bold font-mono text-sm uppercase text-left mb-8">
            This bounty is assigned to another contributor. Only the assigned actor can link their wallet to this module.
          </div>
          <Link href="/dashboard" className="brutal-button w-full py-3 inline-block">
            RETURN_TO_BASE
          </Link>
        </div>
      ) : (
        <>
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
      )}
    </>
  );
}

export default function ConnectPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white brutal-border p-8 md:p-12 brutal-shadow relative">
        <button 
          onClick={() => router.back()}
          className="absolute top-0 right-0 w-8 h-8 bg-blue-600 border-b-4 border-l-4 border-slate-950 flex items-center justify-center text-white hover:bg-slate-950 transition-colors cursor-pointer group z-20"
          aria-label="Go back"
        >
          <X size={20} strokeWidth={3} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
        <Suspense fallback={<div className="font-mono font-bold text-sm uppercase text-slate-500 animate-pulse">LOADING_MODULE...</div>}>
          <ConnectForm />
        </Suspense>
      </div>
    </div>
  );
}
