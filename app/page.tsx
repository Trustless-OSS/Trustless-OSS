import Image from 'next/image';
import { SiGithub, SiGitlab } from 'react-icons/si';
import { ArrowRight, GitBranch, GitMerge, GitPullRequest, Tags, WalletCards } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import Navbar from './components/layout/Navbar';
import HeroSection from './components/home/HeroSection';
import EscrowEventLog from './components/escrow/EscrowEventLog';
import ContributorLeaderboard from './components/dashboard/ContributorLeaderboard';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const workflowItems = [
  {
    step: '01',
    title: 'Connect a repository',
    desc: 'Install the GitHub App and bring the repository into one maintainer dashboard.',
    detail: 'GitHub App',
    icon: GitBranch,
  },
  {
    step: '02',
    title: 'Secure the reward',
    desc: 'Deploy a Trustless Work escrow and fund the bounty pool with Stellar USDC.',
    detail: 'Fund repository',
    icon: WalletCards,
  },
  {
    step: '03',
    title: 'Label and assign',
    desc: 'Add a reward tier to an issue, assign a contributor, and register their payout wallet.',
    detail: 'Create bounty',
    icon: Tags,
  },
  {
    step: '04',
    title: 'Merge and release',
    desc: 'A linked merged pull request becomes the proof that unlocks the milestone payout.',
    detail: 'Release USDC',
    icon: GitPullRequest,
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
    <div className="landing-page-shell relative flex flex-col selection:bg-primary selection:text-primary-foreground">
      <Navbar user={user} />

      <main className="relative flex w-full flex-1 flex-col overflow-hidden px-3 pb-0 pt-4 sm:px-5 md:px-6 lg:px-7">
        <HeroSection user={user} />

        <section className="relative mb-20 pt-4 md:mb-28 md:pt-8" aria-labelledby="workflow-title">
          <GitMerge
            className="landing-watermark -right-14 top-6 h-52 w-52 rotate-12 text-primary md:h-72 md:w-72"
            strokeWidth={1.2}
            aria-hidden="true"
          />

          <div className="relative z-10 mb-9 grid gap-5 md:mb-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(300px,0.55fr)] lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                A clear path from issue to payout
              </p>
              <h2
                id="workflow-title"
                className="font-display mt-4 max-w-4xl text-3xl font-extrabold leading-[0.98] tracking-tight text-foreground sm:text-4xl md:text-5xl"
              >
                Less payout admin.
                <br />
                More work shipped.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-muted-foreground lg:justify-self-end">
              Trustless OSS follows the contribution lifecycle maintainers already know. The reward
              state stays visible while GitHub remains the place where work happens.
            </p>
          </div>

          <div className="relative z-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {workflowItems.map(({ step, title, desc, detail, icon: Icon }) => (
              <Card
                key={step}
                className="group relative min-h-0 overflow-hidden rounded-3xl py-0 transition-transform duration-200 hover:-translate-y-1 md:min-h-72"
              >
                <CardHeader className="flex flex-row items-start justify-between gap-4 pt-5 md:pt-6">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                    <Icon className="h-6 w-6" strokeWidth={2.25} aria-hidden="true" />
                  </span>
                  <span className="font-display text-5xl font-extrabold tracking-[-0.08em] text-foreground/12 transition-colors group-hover:text-primary/25">
                    {step}
                  </span>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-2xl font-bold leading-tight">{title}</CardTitle>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{desc}</p>
                </CardContent>
                <CardFooter className="mt-auto justify-between border-0 bg-transparent text-[0.72rem] font-semibold tracking-[0.12em] text-primary uppercase">
                  <span>{detail}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        <section
          className="landing-spotlight relative mb-20 overflow-hidden rounded-3xl px-5 py-7 sm:px-7 sm:py-9 md:mb-28 md:px-10"
          aria-labelledby="issue-platforms-title"
        >
          <Image
            src="/usd-coin-usdc-logo.svg"
            alt=""
            width={240}
            height={240}
            className="landing-watermark -right-12 -top-16 h-56 w-56 rotate-12 opacity-[0.09]"
            aria-hidden="true"
          />
          <div className="relative z-10 grid gap-7 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] lg:items-center">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                Repository-native rewards
              </p>
              <h2
                id="issue-platforms-title"
                className="font-display mt-3 text-2xl font-extrabold leading-none tracking-tight sm:text-3xl"
              >
                Start with an issue.
                <br />
                Finish with a payout.
              </h2>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              <article className="flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-neutral-950">
                  <SiGithub className="h-7 w-7" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black">GitHub Issues</h3>
                  <Badge className="mt-1 h-auto max-w-full rounded-full bg-emerald-400/20 px-2.5 font-mono text-[0.62rem] font-black tracking-wider text-emerald-300 uppercase">
                    Available
                  </Badge>
                </div>
              </article>

              <article className="flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#FC6D26]">
                  <SiGitlab className="h-8 w-8" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black">GitLab Issues</h3>
                  <Badge className="mt-1 h-auto max-w-full rounded-full bg-orange-400/20 px-2.5 font-mono text-[0.62rem] font-black tracking-wider text-orange-300 uppercase">
                    Planned
                  </Badge>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="relative mb-20 md:mb-28" aria-labelledby="leaderboard-title">
          <div className="mb-9 max-w-5xl md:mb-12">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Across every repository
            </p>
            <h2
              id="leaderboard-title"
              className="font-display mt-4 text-3xl font-extrabold leading-[0.98] tracking-tight text-foreground sm:text-4xl md:text-5xl"
            >
              Top contributors,
              <br />
              paid in USDC.
            </h2>
          </div>

          <ContributorLeaderboard limit={4} expandHref="/leaderboard/1" showSeeMore />
        </section>

        <div className="relative mb-20 md:mb-28">
          <EscrowEventLog />
        </div>

        <section className="relative mb-0 hidden md:block" aria-labelledby="payout-routes-title">
          <Image
            src="/usd-coin-usdc-logo.svg"
            alt=""
            width={220}
            height={220}
            className="landing-watermark -left-14 top-0 h-48 w-48 -rotate-12 text-primary md:h-56 md:w-56"
            aria-hidden="true"
          />
          <div className="relative z-10 mb-0 pt-4 md:mb-12 md:pt-8">
            <div className="max-w-5xl">
              <div className="flex items-center gap-3 mb-4">
                <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
                  Cross-chain payout routes
                </p>
                <Badge className="h-auto rounded-full bg-amber-100 px-2.5 py-1 text-[0.65rem] font-bold tracking-wider text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 uppercase">
                  Coming soon
                </Badge>
              </div>
              <h2
                id="payout-routes-title"
                className="font-display mt-4 text-3xl font-extrabold leading-[0.98] tracking-tight text-foreground sm:text-4xl md:text-5xl"
              >
                Fund once on Stellar.
                <br />
                Pay where contributors are.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                Keep the bounty pool in Stellar USDC while contributors select a supported
                destination through the CCTP payout flow.
              </p>
            </div>
          </div>

          <div className="cctp-flow-map relative z-10">
            <svg
              className="cctp-flow-svg"
              viewBox="0 0 1000 560"
              preserveAspectRatio="xMidYMid meet"
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

              <g className="cctp-energy-rings" aria-hidden="true">
                <circle
                  className="cctp-energy-ring cctp-energy-ring-one"
                  cx="500"
                  cy="280"
                  r="44"
                />
                <circle
                  className="cctp-energy-ring cctp-energy-ring-two"
                  cx="500"
                  cy="280"
                  r="44"
                />
              </g>

              <image href="/usd-coin-usdc-logo.svg" width="44" height="44" x="-22" y="-22">
                <animateMotion
                  dur="5.4s"
                  calcMode="linear"
                  keyPoints="0;0;1;1"
                  keyTimes="0;0.08;0.56;1"
                  repeatCount="indefinite"
                  rotate="0"
                >
                  <mpath href="#stellar-to-cctp" />
                </animateMotion>
              </image>

              {destinationChains.map((chain, index) => (
                <image
                  key={`${chain.name}-coin`}
                  href="/usd-coin-usdc-logo.svg"
                  width="30"
                  height="30"
                  x="-15"
                  y="-15"
                >
                  <animateMotion
                    dur="5.4s"
                    calcMode="linear"
                    keyPoints="0;0;1;1"
                    keyTimes={`0;${(0.6 + index * 0.018).toFixed(3)};${(
                      0.86 +
                      index * 0.012
                    ).toFixed(3)};1`}
                    repeatCount="indefinite"
                    rotate="0"
                  >
                    <mpath href={`#cctp-to-${index}`} />
                  </animateMotion>
                </image>
              ))}
            </svg>

            <div className="cctp-logo-node cctp-source-logo" aria-label="Stellar USDC source">
              <span className="cctp-source-launch" aria-hidden="true" />
              <Image
                src="/stellar-xlm-logo.svg"
                alt="Stellar logo"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
            </div>

            <div className="cctp-logo-node cctp-bridge-logo" aria-label="CCTP bridge">
              <span className="cctp-impact-flash" aria-hidden="true" />
              <span className="cctp-bridge-core">CCTP</span>
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
                <span className="cctp-destination-pulse" aria-hidden="true" />
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

        <section
          className="supported-partners-band relative mb-0 overflow-hidden px-5 py-6 sm:px-8 md:py-7"
          aria-labelledby="partners-title"
        >
          <span className="supported-partners-orb supported-partners-orb-one" aria-hidden="true" />
          <span className="supported-partners-orb supported-partners-orb-two" aria-hidden="true" />
          <div className="relative z-10 flex flex-col items-center text-center">
            <p
              id="partners-title"
              className="text-xs font-semibold tracking-[0.22em] text-primary uppercase"
            >
              Supported by
            </p>

            <div
              className="mt-5 flex flex-wrap items-center justify-center gap-10 sm:gap-14"
              aria-label="Supported partners"
            >
              <figure className="partner-logo-mark">
                <Image
                  src="/partners/trustless-escrow.png"
                  alt="Trustless Escrow"
                  width={495}
                  height={434}
                  className="h-20 w-20 object-contain sm:h-24 sm:w-24"
                />
                <figcaption>Trustless Escrow</figcaption>
              </figure>
              <figure className="partner-logo-mark">
                <Image
                  src="/partners/grantfox.png"
                  alt="Grantfox"
                  width={741}
                  height={838}
                  className="h-20 w-20 object-contain sm:h-24 sm:w-24"
                />
                <figcaption>Grantfox</figcaption>
              </figure>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
