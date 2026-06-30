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

import LoadingLogo from '../components/LoadingLogo';

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

  // New payout target state
  const [payoutChain, setPayoutChain] = useState('stellar');
  const [customAddress, setCustomAddress] = useState('');

  useEffect(() => {
    async function checkAccess() {
      if (!issueId || !repoId) {
        setChecking(false);
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          window.location.href = `/login?next=/connect?issue=${issueId}&repo=${repoId}`;
          return;
        }

        const res = await fetch(`${BACKEND}/api/contributor/me`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (res.ok) {
          const { contributor } = await res.json();
          const match = contributor?.assignments?.some(
            (a: any) => String(a.issues?.github_issue_id) === String(issueId)
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
      const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
      return () => clearTimeout(timer);
    } else if (done && redirectUrl && countdown === 0) {
      window.location.href = redirectUrl;
    }
  }, [done, redirectUrl, countdown]);

  function isValidEvmAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  function isValidSolanaAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  async function handleConnect() {
    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

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
          payoutChain: 'stellar',
          payoutAddress: address,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to connect wallet');
      }

      const { repoFullName, issueNumber } = await res.json();
      setRedirectUrl(`https://github.com/${repoFullName}/issues/${issueNumber}`);

      notifySuccess(
        'Wallet Connected',
        'Your payout address has been successfully linked to this issue.'
      );
      setDone(true);
    } catch (e: any) {
      handleError(e, 'Connect Wallet');
      setError(e.message || 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  }

  async function handleCustomConnect() {
    setLoading(true);
    setError('');

    // Validations
    if (payoutChain === 'base' || payoutChain === 'ethereum') {
      if (!isValidEvmAddress(customAddress)) {
        setError('Invalid EVM address structure. Must start with 0x and have 40 hex characters.');
        setLoading(false);
        return;
      }
    } else if (payoutChain === 'solana') {
      if (!isValidSolanaAddress(customAddress)) {
        setError('Invalid Solana address structure. Must be base58 encoded.');
        setLoading(false);
        return;
      }
    }

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = `/login?next=/connect?issue=${issueId}&repo=${repoId}`;
        return;
      }

      const res = await fetch(`${BACKEND}/api/milestones/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          githubIssueId: Number(issueId),
          githubRepoId: Number(repoId),
          wallet: customAddress,
          payoutChain: payoutChain,
          payoutAddress: customAddress,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to link payout address');
      }

      const { repoFullName, issueNumber } = await res.json();
      setRedirectUrl(`https://github.com/${repoFullName}/issues/${issueNumber}`);

      notifySuccess(
        'Payout Target Linked',
        'Your cross-chain payout destination has been successfully registered.'
      );
      setDone(true);
    } catch (e: any) {
      handleError(e, 'Link Payout Target');
      setError(e.message || 'Failed to link payout address');
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
          <span className="text-blue-400">log:</span> Payout wallet mapped to issue registry.
          <br />
          <span className="text-blue-400">log:</span> You may close this window or wait.
          <br />
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
          <LoadingLogo message="VERIFYING_ACTOR..." size="md" />
        </div>
      ) : !isAssigned ? (
        <div className="text-center">
          <div className="text-6xl mb-6 grayscale">🚫</div>
          <h2 className="title-brutal text-2xl text-slate-950 mb-4">ACCESS_DENIED</h2>
          <div className="p-4 bg-red-100 border-[4px] border-slate-950 shadow-[4px_4px_0_0_#000] text-red-600 font-bold font-mono text-sm uppercase text-left mb-8">
            This bounty is assigned to another contributor. Only the assigned actor can link their
            wallet to this module.
          </div>
          <Link href="/dashboard" className="brutal-button w-full py-3 inline-block">
            RETURN_TO_BASE
          </Link>
        </div>
      ) : (
        <>
          <div className="text-6xl mb-6 grayscale text-center">🚀</div>
          <h1 className="title-brutal text-3xl text-slate-950 mb-2 text-center">
            INITIALIZE_PAYOUT
          </h1>

          <div className="mb-6 mt-6">
            <label className="block text-xs font-mono font-bold uppercase text-slate-900 mb-2">
              SELECT_PAYOUT_NETWORK
            </label>
            <select
              value={payoutChain}
              onChange={(e) => {
                setPayoutChain(e.target.value);
                setCustomAddress('');
                setError('');
              }}
              className="w-full bg-white border-4 border-slate-950 px-3 py-2 font-mono font-bold text-sm uppercase shadow-[2px_2px_0_0_#000] focus:translate-x-0.5 focus:translate-y-0.5 focus:shadow-[1px_1px_0_0_#000] outline-none"
            >
              <option value="stellar">Stellar (Direct USDC)</option>
              <option value="base">Base (Circle CCTP)</option>
              <option value="ethereum">Ethereum (Circle CCTP)</option>
              <option value="solana">Solana (Circle CCTP)</option>
            </select>
          </div>

          <div className="terminal-block text-left text-sm mb-6">
            {payoutChain === 'stellar' && (
              <>
                <span className="text-slate-500">// Connect Stellar wallet to receive USDC</span>
                <br />
                <span className="text-slate-500">// Funds will be released upon PR merge</span>
              </>
            )}
            {payoutChain !== 'stellar' && (
              <>
                <span className="text-slate-500">
                  // Enter target address on {payoutChain.toUpperCase()}
                </span>
                <br />
                <span className="text-slate-500">
                  // USDC is burned on Stellar and minted on destination via CCTP
                </span>
              </>
            )}
          </div>

          {payoutChain !== 'stellar' && (
            <div className="mb-6">
              <label className="block text-xs font-mono font-bold uppercase text-slate-900 mb-2">
                {payoutChain.toUpperCase()}_RECIPIENT_ADDRESS
              </label>
              <input
                type="text"
                placeholder={payoutChain === 'solana' ? 'Solana Address' : '0x... Address'}
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                className="w-full bg-white border-4 border-slate-950 px-3 py-3 font-mono text-sm shadow-[2px_2px_0_0_#000] outline-none"
              />
            </div>
          )}

          {error && (
            <div className="mb-8 p-4 bg-red-100 border-[4px] border-slate-950 shadow-[4px_4px_0_0_#ef4444] text-red-600 font-bold font-mono text-sm uppercase">
              ERR: {error}
            </div>
          )}

          {payoutChain === 'stellar' ? (
            <button
              id="connect-wallet-btn"
              onClick={handleConnect}
              disabled={loading}
              className="brutal-button w-full py-4 text-lg flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  <span>CONNECTING...</span>
                </>
              ) : (
                'CONNECT_WALLET'
              )}
            </button>
          ) : (
            <button
              onClick={handleCustomConnect}
              disabled={loading || !customAddress}
              className="brutal-button w-full py-4 text-lg flex items-center justify-center gap-3 animate-pulse"
            >
              {loading ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  <span>LINKING...</span>
                </>
              ) : (
                'LINK_PAYOUT_ADDRESS'
              )}
            </button>
          )}

          <div className="mt-8 pt-6 border-t-[4px] border-slate-950 border-dashed text-center">
            <p className="text-xs text-slate-600 font-mono font-bold uppercase">
              Don't have a wallet?{' '}
              <a
                href={
                  payoutChain === 'solana'
                    ? 'https://phantom.app/'
                    : payoutChain === 'stellar'
                      ? 'https://lobstr.co'
                      : 'https://metamask.io/'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:bg-blue-600 hover:text-white transition-colors border-b-2 border-blue-600"
              >
                {payoutChain === 'solana'
                  ? 'GET_PHANTOM'
                  : payoutChain === 'stellar'
                    ? 'GET_LOBSTR'
                    : 'GET_METAMASK'}
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
          <X
            size={20}
            strokeWidth={3}
            className="group-hover:rotate-90 transition-transform duration-300"
          />
        </button>
        <Suspense
          fallback={
            <div className="font-mono font-bold text-sm uppercase text-slate-500 animate-pulse">
              LOADING_MODULE...
            </div>
          }
        >
          <ConnectForm />
        </Suspense>
      </div>
    </div>
  );
}
