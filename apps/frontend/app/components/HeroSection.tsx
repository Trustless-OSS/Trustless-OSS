import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { ArrowUpRight, CircleDollarSign, Info, Orbit } from 'lucide-react';

interface HeroSectionProps {
  user?: User | null;
}

const networkPills = [
  {
    label: 'USDC',
    detail: 'USD_COIN',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: CircleDollarSign,
  },
  {
    label: 'XLM',
    detail: 'STELLAR',
    className: 'bg-violet-50 text-violet-700 border-violet-200',
    icon: Orbit,
  },
  {
    label: 'STELLAR_NETWORK',
    detail: 'LIVE',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: Orbit,
  },
];

export default function HeroSection({ user }: HeroSectionProps) {
  const isAuthenticated = Boolean(user);
  const primaryAction = isAuthenticated
    ? { href: '/dashboard', label: 'ACCESS_DASHBOARD' }
    : { href: '/login', label: 'INIT_PROTOCOL' };

  return (
    <section
      aria-labelledby="landing-hero-title"
      className="relative mb-32 border-l-4 border-blue-600 pl-5 sm:pl-8 lg:pl-10 pt-5 md:pt-10"
    >
      <div className="grid min-h-[680px] items-center gap-12 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.85fr)] lg:gap-20">
        <div className="max-w-4xl">
          <div className="animate-hero-in hero-stagger-1 label-brutal mb-8 inline-flex w-fit items-center gap-3 rounded-sm bg-slate-950 px-4 py-2 text-white brutal-shadow-blue">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />
            <span>SYS_STATUS // </span>
            <span className="text-blue-400">OPERATIONAL</span>
          </div>

          <h1
            id="landing-hero-title"
            className="animate-hero-in hero-stagger-2 title-brutal mb-8 text-5xl text-slate-950 sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl"
          >
            AUTOMATED <br />
            <span className="text-blue-600">BOUNTIES</span> <br />
            FOR OSS.
          </h1>

          <div className="animate-hero-in hero-stagger-3 mb-8 flex flex-wrap gap-3">
            {networkPills.map(({ label, detail, className, icon: Icon }) => (
              <span
                key={label}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[0.7rem] font-black uppercase shadow-sm ${className}`}
              >
                <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
                <span>{detail}</span>
                <span aria-hidden="true">({label})</span>
              </span>
            ))}
          </div>

          <p className="animate-hero-in hero-stagger-4 mb-10 max-w-2xl font-mono text-base font-bold leading-8 text-slate-700 md:text-lg">
            A repository-linked milestone release mechanism for GitHub issues. Lock USDC/XLM
            smart-pools into audited escrows, then release funds automatically after verified pull
            request merge events.
          </p>

          <div className="animate-hero-in hero-stagger-5 flex flex-col gap-5 sm:flex-row">
            <Link
              href={primaryAction.href}
              className="brutal-button hero-cta group min-h-16 w-full gap-3 px-8 py-5 text-sm sm:w-auto sm:text-base"
              title={isAuthenticated ? 'Open dashboard' : 'Start authentication'}
            >
              <span>{primaryAction.label}</span>
              <ArrowUpRight
                size={20}
                strokeWidth={3}
                className="transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
                aria-hidden="true"
              />
            </Link>

            <Link
              href="/docs"
              className="brutal-button-outline hero-cta min-h-16 w-full gap-3 px-8 py-5 text-sm sm:w-auto sm:text-base"
              title="Read protocol documentation"
            >
              <span>READ_DOCS</span>
              <Info size={20} strokeWidth={3} aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="animate-hero-in hero-stagger-6 hero-terminal brutal-shadow-blue">
          <div className="flex items-center justify-between border-b border-slate-700/70 px-5 py-4">
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
            </div>
            <span className="font-mono text-xs font-black uppercase text-slate-500">
              v1.0.8 (Operational)
            </span>
          </div>

          <pre className="overflow-x-auto p-5 text-sm leading-8 md:p-7 md:text-base">
            <code>
              <span className="text-cyan-400">&gt; CMD_PROMPT_INPUT</span>
              {'\n\n'}
              <span className="text-slate-500">
                {'// Initialize decentralized escrow contract'}
              </span>
              {'\n'}
              <span className="text-fuchsia-400">const</span>{' '}
              <span className="text-slate-50">protocol</span>{' '}
              <span className="text-slate-400">=</span>{' '}
              <span className="text-amber-300">"Trustless Escrow"</span>
              <span className="text-slate-50">;</span>
              {'\n'}
              <span className="text-slate-500">
                {'// Fund GitHub milestones with secure multi-asset pools'}
              </span>
              {'\n'}
              <span className="text-cyan-400">&gt; Initializing protocol interface...</span>
              {'\n'}
              <span className="text-blue-400">
                &gt; Successfully bound ryzen-xp/crypto-guardian [Stellar Network]
              </span>
              {'\n'}
              <span className="text-slate-500">
                {'// PR approval & merge triggers automated instant releases'}
              </span>
              {'\n'}
              <span className="text-fuchsia-400">await</span>{' '}
              <span className="text-emerald-400">executeRelease</span>
              <span className="text-slate-50">(</span>
              <span className="text-cyan-300">"Milestone_1"</span>
              <span className="text-slate-50">);</span>
            </code>
          </pre>

          <div className="flex flex-col gap-2 border-t border-slate-700/70 px-5 py-4 font-mono text-xs font-black uppercase text-emerald-400 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
              On-chain releases operational
            </span>
            <span className="text-slate-500">Gas Cost: 21K gwei</span>
          </div>
        </div>
      </div>
    </section>
  );
}
