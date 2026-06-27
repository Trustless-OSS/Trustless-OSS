import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import Navbar from './components/Navbar';
import HeroSection from './components/HeroSection';

const workflowItems = [
  {
    step: '01',
    title: 'FUND_ESCROW',
    desc: 'Maintainer deposits USDC into a Trustless Work multi-release escrow for their repository.',
    metric: 'USDC',
  },
  {
    step: '02',
    title: 'LABEL_ISSUES',
    desc: 'Add `rewarded` + difficulty labels to issues. The bot reserves funds automatically.',
    metric: 'LABEL',
  },
  {
    step: '03',
    title: 'AUTO_RELEASE',
    desc: 'Contributor merges a PR. Webhook fires, and the payout route is executed automatically.',
    metric: 'MERGE',
  },
];

const destinationChains = [
  {
    name: 'Ethereum',
    logo: '/ethereum-eth-logo.svg',
    logoAlt: 'Ethereum logo',
  },
  {
    name: 'Solana',
    logo: '/solana-sol-logo.png',
    logoAlt: 'Solana logo',
  },
  {
    name: 'Arbitrum',
    logo: '/arbitrum-arb-logo.png',
    logoAlt: 'Arbitrum logo',
  },
  {
    name: 'Optimism',
    logo: '/optimism-ethereum-op-logo.png',
    logoAlt: 'Optimism logo',
  },
  {
    name: 'BNB Chain',
    logo: '/bnb-bnb-logo.png',
    logoAlt: 'BNB Chain logo',
  },
  {
    name: 'Starknet',
    logo: '/starknet-token-strk-logo.png',
    logoAlt: 'Starknet logo',
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="relative min-h-[calc(100vh-24px)] flex flex-col selection:bg-blue-600 selection:text-white">
      <Navbar user={user} />

      <main className="flex-1 flex flex-col w-full px-6 md:px-12 pt-4 pb-32">
        <HeroSection user={user} />

        <div className="w-full border-t-[4px] border-slate-950 mb-32 border-dashed"></div>

        {/* Feature Grid */}
        <section className="mb-32">
          <div className="flex justify-between items-end mb-16 border-b-[4px] border-slate-950 pb-4">
            <h2 className="title-brutal text-4xl md:text-6xl text-slate-950">WORKFLOW_</h2>
            <div className="label-brutal text-slate-500">ARCHITECTURE</div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {workflowItems.map((item) => (
              <div key={item.step} className="bg-white brutal-border p-8 brutal-shadow relative">
                <div className="absolute top-0 right-0 bg-blue-600 text-white font-mono font-bold px-3 py-1 border-b-4 border-l-4 border-slate-950">
                  {item.step}
                </div>
                <div className="text-5xl font-black text-slate-200 mb-6 font-mono tracking-tighter">
                  {item.metric}
                </div>
                <h3 className="title-brutal text-2xl text-slate-950 mb-4">{item.title}</h3>
                <p className="text-slate-700 font-medium font-mono text-xs">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-32">
          <div className="mb-16 flex items-end justify-between border-b-[4px] border-slate-950 pb-4">
            <div>
              <h2 className="title-brutal text-4xl text-slate-950 md:text-6xl">CCTP_PAYOUTS</h2>
              <p className="mt-4 max-w-2xl font-mono text-sm font-bold uppercase tracking-[0.16em] text-slate-500">
                Fund on Stellar USDC, let contributors receive USDC on their preferred chain.
              </p>
            </div>
            <div className="label-brutal text-slate-500">CROSS_CHAIN_ROUTE</div>
          </div>

          <div className="cctp-flow-map brutal-border relative overflow-hidden bg-white">
            <svg
              className="cctp-flow-svg"
              viewBox="0 0 1000 560"
              role="img"
              aria-label="USDC moves from Stellar through CCTP to supported destination chains"
            >
              <defs>
                <path id="stellar-to-cctp" d="M150 280 C260 125 385 125 500 280" />
                <path id="cctp-to-0" d="M570 280 C620 100 685 55 780 56" />
                <path id="cctp-to-1" d="M570 280 C660 130 750 120 860 137" />
                <path id="cctp-to-2" d="M570 280 C690 205 805 205 910 224" />
                <path id="cctp-to-3" d="M570 280 C690 355 805 355 910 336" />
                <path id="cctp-to-4" d="M570 280 C660 430 750 440 860 423" />
                <path id="cctp-to-5" d="M570 280 C620 460 685 505 780 504" />
              </defs>

              <g className="cctp-smoke-trails cctp-smoke-trails-inbound" aria-hidden="true">
                <use href="#stellar-to-cctp" />
                <use href="#stellar-to-cctp" className="cctp-smoke-core" />
              </g>

              <g className="cctp-smoke-trails cctp-smoke-trails-outbound" aria-hidden="true">
                {destinationChains.map((chain, index) => (
                  <use
                    key={`${chain.name}-smoke`}
                    href={`#cctp-to-${index}`}
                    style={{ animationDelay: `${2.1 + index * 0.08}s` }}
                  />
                ))}
                {destinationChains.map((chain, index) => (
                  <use
                    key={`${chain.name}-core-smoke`}
                    className="cctp-smoke-core"
                    href={`#cctp-to-${index}`}
                    style={{ animationDelay: `${2.16 + index * 0.08}s` }}
                  />
                ))}
              </g>

              <image
                className="cctp-flow-coin"
                href="/usd-coin-usdc-logo.svg"
                width="38"
                height="38"
                x="-19"
                y="-19"
              >
                <animateMotion dur="2.8s" repeatCount="indefinite" rotate="auto">
                  <mpath href="#stellar-to-cctp" />
                </animateMotion>
              </image>

              {destinationChains.map((chain, index) => (
                <image
                  key={`${chain.name}-coin`}
                  className="cctp-flow-coin cctp-flow-coin-small"
                  href="/usd-coin-usdc-logo.svg"
                  width="30"
                  height="30"
                  x="-15"
                  y="-15"
                >
                  <animateMotion
                    dur="2.8s"
                    begin={`${2.18 + index * 0.1}s`}
                    repeatCount="indefinite"
                    rotate="auto"
                  >
                    <mpath href={`#cctp-to-${index}`} />
                  </animateMotion>
                </image>
              ))}
            </svg>

            <div className="cctp-logo-node cctp-source-logo" aria-label="Stellar USDC source">
              <Image
                src="/stellar-xlm-logo.svg"
                alt="Stellar logo"
                width={52}
                height={44}
                className="h-11 w-11 object-contain"
              />
              <Image
                src="/usd-coin-usdc-logo.svg"
                alt="USDC logo"
                width={42}
                height={42}
                className="cctp-mini-usdc h-10 w-10"
              />
            </div>

            <div className="cctp-logo-node cctp-bridge-logo" aria-label="CCTP bridge">
              <span className="cctp-impact-flash" aria-hidden="true" />
              <span>CCTP</span>
              <span className="cctp-impact-burst" aria-hidden="true">
                {Array.from({ length: 10 }).map((_, index) => (
                  <span key={index} className={`cctp-impact-shard cctp-impact-shard-${index}`} />
                ))}
              </span>
            </div>

            {destinationChains.map((chain, index) => (
              <div
                key={chain.name}
                className={`cctp-logo-node cctp-destination-logo cctp-destination-logo-${index}`}
                aria-label={chain.name}
              >
                <Image
                  src={chain.logo}
                  alt={chain.logoAlt}
                  width={54}
                  height={54}
                  className="h-12 w-12 object-contain"
                />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
