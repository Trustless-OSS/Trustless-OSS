'use client';

import Link from 'next/link';
import Navbar from '../components/Navbar';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DocsPage() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-24px)] flex flex-col selection:bg-blue-600 selection:text-white">
      <Navbar user={user} breadcrumbs={[{ label: 'DOCS' }]} />

      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-16">
        <div className="label-brutal bg-slate-950 text-white inline-flex px-3 py-1 mb-8 brutal-shadow animate-pulse-brutal">
          SYS.DOCS // END_TO_END_PROTOCOL_SPEC
        </div>

        <h1 className="title-brutal text-6xl md:text-8xl text-slate-950 mb-12 italic uppercase tracking-tighter">
          HOW_IT_WORKS
        </h1>

        {/* Graphical View Section */}
        <section className="mb-24">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-2 bg-blue-600"></div>
            <h2 className="title-brutal text-3xl text-slate-950">VISUAL_WORKFLOW</h2>
          </div>

          <div className="bg-slate-50 brutal-border p-8 md:p-12 brutal-shadow-blue overflow-x-auto">
            <div className="min-w-[900px] flex flex-col gap-16 relative">
              {/* Maintainer Start */}
              <div className="flex items-center gap-8">
                <div className="flex-shrink-0 w-48 bg-white brutal-border p-4 brutal-shadow">
                  <span className="label-brutal text-blue-600 mb-2 block">STEP_01</span>
                  <p className="font-bold text-xs uppercase">Maintainer Logs in & Connects Repo</p>
                </div>
                <div className="flex-grow h-1 bg-slate-950 relative">
                  <div className="absolute right-0 -top-1.5 w-4 h-4 border-r-4 border-t-4 border-slate-950 rotate-45"></div>
                </div>
                <div className="flex-shrink-0 w-48 bg-white brutal-border p-4 brutal-shadow">
                  <span className="label-brutal text-blue-600 mb-2 block">STEP_02</span>
                  <p className="font-bold text-xs uppercase">Install GitHub App on Repo</p>
                </div>
                <div className="flex-grow h-1 bg-slate-950 relative">
                  <div className="absolute right-0 -top-1.5 w-4 h-4 border-r-4 border-t-4 border-slate-950 rotate-45"></div>
                </div>
                <div className="flex-shrink-0 w-48 bg-blue-600 text-white brutal-border p-4 brutal-shadow">
                  <span className="label-brutal text-white mb-2 block">STEP_03</span>
                  <p className="font-bold text-xs uppercase">Deploy Multi-Release Escrow (On-Chain)</p>
                </div>
              </div>

              {/* GitHub Interaction */}
              <div className="flex items-center gap-8 translate-x-12">
                <div className="w-1 h-12 bg-slate-950 ml-24"></div>
              </div>

              <div className="flex items-center gap-8">
                <div className="flex-shrink-0 w-48 bg-white brutal-border p-4 brutal-shadow">
                  <span className="label-brutal text-blue-600 mb-2 block">STEP_04</span>
                  <p className="font-bold text-xs uppercase">Label Issue (Low/Med/High/Custom)</p>
                </div>
                <div className="flex-grow h-1 bg-slate-950 relative">
                  <div className="absolute right-0 -top-1.5 w-4 h-4 border-r-4 border-t-4 border-slate-950 rotate-45"></div>
                </div>
                <div className="flex-shrink-0 w-48 bg-slate-950 text-white brutal-border p-4 brutal-shadow">
                  <span className="label-brutal text-blue-400 mb-2 block">STEP_05</span>
                  <p className="font-bold text-xs uppercase">Bot Comments & Asks for Wallet</p>
                </div>
                <div className="flex-grow h-1 bg-slate-950 relative">
                  <div className="absolute right-0 -top-1.5 w-4 h-4 border-r-4 border-t-4 border-slate-950 rotate-45"></div>
                </div>
                <div className="flex-shrink-0 w-48 bg-white brutal-border p-4 brutal-shadow">
                  <span className="label-brutal text-blue-600 mb-2 block">STEP_06</span>
                  <p className="font-bold text-xs uppercase">Contributor Links Stellar Wallet</p>
                </div>
              </div>

              {/* Payout */}
              <div className="flex items-center gap-8 translate-x-12">
                <div className="w-1 h-12 bg-slate-950 ml-[820px]"></div>
              </div>

              <div className="flex justify-end gap-8">
                <div className="flex-shrink-0 w-56 bg-white brutal-border p-4 brutal-shadow">
                  <span className="label-brutal text-blue-600 mb-2 block">STEP_07</span>
                  <p className="font-bold text-xs uppercase">Milestone Created On-Chain</p>
                </div>
                <div className="w-24 h-1 bg-slate-950 self-center relative">
                  <div className="absolute right-0 -top-1.5 w-4 h-4 border-r-4 border-t-4 border-slate-950 rotate-45"></div>
                </div>
                <div className="flex-shrink-0 w-56 bg-blue-600 text-white brutal-border p-6 brutal-shadow-blue animate-pulse-brutal">
                  <span className="label-brutal text-white mb-2 block">FINAL_EXECUTION</span>
                  <p className="text-lg font-black uppercase">PR Merged → Instant Payout</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Maintainer Deep Dive */}
        <section className="mb-24">
          <h2 className="title-brutal text-4xl text-slate-950 mb-8 underline decoration-blue-600 underline-offset-8">MAINTAINER_POV</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="terminal-block">
              <span className="text-blue-400">01_SETUP:</span><br />
              Log in with GitHub. In your dashboard, click "Connect Repo" to authorize our GitHub App on your chosen repositories.
            </div>
            <div className="terminal-block">
              <span className="text-blue-400">02_INFRASTRUCTURE:</span><br />
              Navigate to the repo in our DApp and click <span className="text-white bg-blue-600 px-1">DEPLOY_ESCROW</span>. This deploys a multi-release smart contract on Stellar. You will need to sign this with a Stellar wallet (e.g., Albedo/Freighter).
            </div>
            <div className="terminal-block">
              <span className="text-blue-400">03_BOUNTY_ASSIGNMENT:</span><br />
              Go to your GitHub issue and add one of these labels:<br />
              • <span className="text-green-400">low</span><br />
              • <span className="text-yellow-400">medium</span><br />
              • <span className="text-red-400">high</span><br />
              • <span className="text-purple-400">custom</span>
            </div>
            <div className="terminal-block">
              <span className="text-blue-400">04_CUSTOM_AMOUNTS:</span><br />
              If you use the 'custom' label, simply comment on the issue:<br />
              <span className="text-yellow-200">@trustless-oss-bot 150</span><br />
              The bot will update the milestone in our database immediately.
            </div>
            <div className="terminal-block">
              <span className="text-blue-400">05_LIQUIDITY_MANAGEMENT:</span><br />
              Need your funds back? Use the <span className="text-white bg-red-600 px-1">REFUND_FUNDS</span> button in your dashboard. This generates an on-chain transaction to pull USDC from the escrow back to your wallet.
            </div>
          </div>
        </section>

        {/* Contributor Deep Dive */}
        <section className="mb-24">
          <h2 className="title-brutal text-4xl text-slate-950 mb-8 underline decoration-blue-600 underline-offset-8">CONTRIBUTOR_POV</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="terminal-block">
              <span className="text-blue-400">01_REGISTRATION:</span><br />
              Once assigned to a labeled issue, the bot will post a link. Click it to connect your Stellar wallet.
            </div>
            <div className="terminal-block">
              <span className="text-blue-400">02_ON_CHAIN_SYNC:</span><br />
              As soon as your wallet is linked, the DApp creates a milestone **on-chain** inside the repo's escrow. Your payment is now cryptographically secured.
            </div>
            <div className="terminal-block">
              <span className="text-blue-400">03_PAYOUT:</span><br />
              Open your PR. When the maintainer merges it, our protocol detects the event and **instantly** releases the USDC funds from the escrow to your wallet.
            </div>
            <div className="terminal-block">
              <span className="text-blue-400">04_HELP_COMMANDS:</span><br />
              Need to change your address or see status? Comment:<br />
              <span className="text-yellow-200">@trustless-oss-bot /help</span><br />
              Follow the prompts to update your configuration.
            </div>
          </div>
        </section>

        <div className="bg-slate-950 text-white p-12 brutal-border brutal-shadow text-center">
          <h2 className="title-brutal text-3xl mb-8 uppercase">SECURE_TRANSPARENT_AUTOMATED</h2>
          <div className="flex flex-wrap justify-center gap-6">
            <Link href="/dashboard" className="brutal-button-outline bg-white text-slate-950 px-8 py-4">
              GO_TO_DASHBOARD
            </Link>
            <Link href="/" className="brutal-button px-8 py-4">
              RETURN_HOME
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
