'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Suspense } from 'react';
import { getWalletKit, withTimeout, WALLET_OPERATION_TIMEOUT_MS } from '@/lib/wallet-kit';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { handleError, notifySuccess } from '@/lib/notifications';

import LoadingLogo from '../components/layout/LoadingLogo';
import Navbar from '../components/layout/Navbar';
import { FormFieldsSkeleton } from '../components/layout/PageSkeletons';
import { backendUrl } from '@/lib/backend';
import Button from '@/app/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

        const res = await fetch(backendUrl('/api/v1/contributor/me'), {
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

      const kit = await getWalletKit();

      const { address } = await withTimeout(
        kit.authModal(),
        WALLET_OPERATION_TIMEOUT_MS,
        'Wallet authorization timed out. Please close the wallet modal and try again.'
      );
      if (!address) throw new Error('No public key returned');

      const res = await fetch(backendUrl('/api/v1/milestones/push'), {
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

      const res = await fetch(backendUrl('/api/v1/milestones/push'), {
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
        <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Success</p>
        <h2 className="font-display mt-3 text-3xl font-extrabold tracking-tight text-foreground">
          Wallet linked
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Your payout address is mapped to this issue. You can close this window or wait to be
          redirected.
        </p>
        <p className="mt-6 text-sm font-medium text-foreground">Redirecting in {countdown}s...</p>
        <a
          href={redirectUrl}
          className="mt-4 inline-block text-xs font-medium text-muted-foreground underline underline-offset-4 hover:text-primary"
        >
          Click here if not redirected automatically
        </a>
      </div>
    );
  }

  return (
    <>
      <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">Claim bounty</p>

      {checking ? (
        <FormFieldsSkeleton />
      ) : !isAssigned ? (
        <div className="text-center">
          <h2 className="font-display mt-4 text-2xl font-extrabold tracking-tight text-foreground">
            Access denied
          </h2>
          <Alert variant="destructive" className="mt-4 mb-8 text-left">
            <AlertDescription>
              This bounty is assigned to another contributor. Only the assigned actor can link their
              wallet to this module.
            </AlertDescription>
          </Alert>
          <Button href="/dashboard" className="w-full">
            Return to dashboard
          </Button>
        </div>
      ) : (
        <>
          <h1 className="font-display mt-3 text-center text-3xl font-extrabold tracking-tight text-foreground">
            Initialize payout
          </h1>

          <div className="mt-6 mb-6">
            <Label htmlFor="payout-network">Payout network</Label>
            <Select
              value={payoutChain}
              onValueChange={(value) => {
                setPayoutChain(value);
                setCustomAddress('');
                setError('');
              }}
            >
              <SelectTrigger id="payout-network" className="mt-2 h-10 w-full">
                <SelectValue placeholder="Select a network" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stellar">Stellar (Direct USDC)</SelectItem>
                <SelectItem value="base">Base (Circle CCTP)</SelectItem>
                <SelectItem value="ethereum">Ethereum (Circle CCTP)</SelectItem>
                <SelectItem value="solana">Solana (Circle CCTP)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="mb-6 text-sm leading-6 text-muted-foreground">
            {payoutChain === 'stellar'
              ? 'Connect a Stellar wallet to receive USDC. Funds are released when the pull request is merged.'
              : `Enter the destination address on ${payoutChain}. USDC is burned on Stellar and minted on the destination via CCTP.`}
          </p>

          {payoutChain !== 'stellar' && (
            <div className="mb-6">
              <Label htmlFor="payout-address">{payoutChain} recipient address</Label>
              <Input
                id="payout-address"
                type="text"
                placeholder={payoutChain === 'solana' ? 'Solana Address' : '0x... Address'}
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                className="mt-2 h-11 font-mono"
              />
            </div>
          )}

          {error && (
            <Alert variant="destructive" className="mb-8">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {payoutChain === 'stellar' ? (
            <Button
              id="connect-wallet-btn"
              onClick={handleConnect}
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  Connecting
                </>
              ) : (
                'Connect wallet'
              )}
            </Button>
          ) : (
            <Button
              onClick={handleCustomConnect}
              disabled={loading || !customAddress}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  Linking
                </>
              ) : (
                'Link payout address'
              )}
            </Button>
          )}

          <div className="mt-8 border-t border-border pt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Don&apos;t have a wallet?{' '}
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
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {payoutChain === 'solana'
                  ? 'Get Phantom'
                  : payoutChain === 'stellar'
                    ? 'Get Lobstr'
                    : 'Get MetaMask'}
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
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <Card className="relative w-full max-w-md rounded-3xl py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="absolute top-4 right-4 z-20 h-9 w-9 rounded-md px-0"
            aria-label="Go back"
          >
            <X size={18} strokeWidth={2.25} />
          </Button>
          <CardContent className="p-8 md:p-10">
            <Suspense fallback={<FormFieldsSkeleton />}>
              <ConnectForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
