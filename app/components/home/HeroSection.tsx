import Image from 'next/image';
import type { User } from '@supabase/supabase-js';
import { SiGithub } from 'react-icons/si';
import {
  ArrowUpRight,
  BookOpen,
  CircleCheck,
  GitBranch,
  GitPullRequest,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import Button from '@/app/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface HeroSectionProps {
  user?: User | null;
}

const networkPills = [
  {
    label: 'USDC',
    iconSrc: '/usd-coin-usdc-logo.svg',
    iconAlt: 'USDC logo',
  },
  {
    label: 'Stellar chain',
    iconSrc: '/stellar-xlm-logo.svg',
    iconAlt: 'Stellar logo',
  },
];

const bountySteps = [
  {
    title: 'Reward secured',
    detail: 'USDC reserved in escrow',
    icon: ShieldCheck,
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  },
  {
    title: 'Contributor assigned',
    detail: 'Wallet linked to the issue',
    icon: WalletCards,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  },
  {
    title: 'Merge releases payout',
    detail: 'The pull request is the proof',
    icon: GitPullRequest,
    className: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  },
];

export default function HeroSection({ user }: HeroSectionProps) {
  const isAuthenticated = Boolean(user);
  const primaryAction = isAuthenticated
    ? { href: '/dashboard', label: 'Open dashboard' }
    : { href: '/login', label: 'Connect GitHub' };

  return (
    <section
      aria-labelledby="landing-hero-title"
      className="home-hero relative mb-20 pt-7 md:mb-24 lg:pt-14"
    >
      <div className="home-hero-backdrop" aria-hidden="true">
        <span className="home-hero-wordmark">USDC</span>
        <span className="home-hero-orbit" />
        <span className="hero-usdc-token hero-usdc-token-one">
          <Image src="/usd-coin-usdc-logo.svg" alt="" width={88} height={88} />
        </span>
        <span className="hero-usdc-token hero-usdc-token-two">
          <Image src="/usd-coin-usdc-logo.svg" alt="" width={112} height={112} />
        </span>
        <span className="hero-usdc-token hero-usdc-token-three">
          <Image src="/usd-coin-usdc-logo.svg" alt="" width={64} height={64} />
        </span>
      </div>

      <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.72fr)] lg:gap-16">
        <div className="relative z-10 max-w-5xl">
          <Badge
            variant="outline"
            className="animate-hero-in hero-stagger-1 mb-6 h-auto max-w-full gap-2 rounded-md bg-card/80 px-3 py-2 text-[0.72rem] font-semibold tracking-[0.08em] uppercase sm:mb-7 sm:gap-3 sm:px-4"
          >
            <SiGithub className="h-4 w-4 text-foreground" aria-hidden="true" />
            GitHub-native contributor payments
          </Badge>

          <h1
            id="landing-hero-title"
            className="animate-hero-in hero-stagger-2 font-display max-w-5xl text-[clamp(2.1rem,8vw,6.2rem)] font-extrabold leading-[0.92] tracking-[-0.05em] text-foreground"
          >
            Fund the work
            <br />
            Merge the proof
            <br />
            <span className="text-primary">Release the reward</span>
          </h1>

          <p className="animate-hero-in hero-stagger-3 mt-8 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl">
            Turn GitHub issues into escrow-backed bounties. Contributors know the reward before they
            start, and maintainers release USDC through the workflow they already use.
          </p>

          <div className="animate-hero-in hero-stagger-4 mt-7 flex flex-wrap gap-3">
            {networkPills.map(({ label, iconSrc, iconAlt }) => (
              <Badge
                key={label}
                variant="secondary"
                className="h-auto gap-2 rounded-md px-3.5 py-2 text-[0.72rem] font-semibold"
              >
                <Image src={iconSrc} alt={iconAlt} width={18} height={18} className="h-4 w-4" />
                {label}
              </Badge>
            ))}
          </div>

          <div className="animate-hero-in hero-stagger-5 mt-10 flex flex-col gap-3 sm:flex-row">
            <Button href={primaryAction.href} size="lg" className="w-full sm:w-auto">
              {primaryAction.label}
              <ArrowUpRight className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
            </Button>
            <Button href="/docs" variant="outline" size="lg" className="w-full sm:w-auto">
              <BookOpen className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
              Read the guide
            </Button>
          </div>
        </div>

        <Card
          aria-label="Example bounty lifecycle"
          className="home-bounty-preview animate-hero-in hero-stagger-6 relative z-10 overflow-hidden rounded-3xl py-6 ring-1 ring-border/80"
        >
          <CardHeader className="flex flex-col items-start justify-between gap-4 border-b border-border/70 px-6 pb-5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-foreground text-background">
                <GitBranch className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-primary uppercase">
                  Example bounty
                </p>
                <p className="mt-1 truncate text-sm font-bold text-foreground">
                  trustless-oss / web
                </p>
              </div>
            </div>
            <Badge className="rounded-full bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15">
              Escrow backed
            </Badge>
          </CardHeader>

          <CardContent className="px-6 py-6">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                  Issue #128
                </p>
                <h2 className="mt-2 max-w-xs text-2xl font-extrabold leading-tight text-foreground">
                  Improve contributor wallet onboarding
                </h2>
              </div>
              <CircleCheck
                className="h-7 w-7 shrink-0 text-primary"
                strokeWidth={2.5}
                aria-hidden="true"
              />
            </div>

            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-primary px-4 py-5 text-primary-foreground">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white">
                  <Image
                    src="/usd-coin-usdc-logo.svg"
                    alt="USDC"
                    width={48}
                    height={48}
                    className="h-11 w-11"
                  />
                </span>
                <div>
                  <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-blue-100 uppercase">
                    Secured reward
                  </p>
                  <p className="mt-1 text-4xl font-extrabold tracking-tight">500 USDC</p>
                </div>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-[0.65rem] font-semibold tracking-[0.18em] text-blue-100 uppercase">
                  Settlement asset
                </p>
                <p className="mt-1 text-sm font-semibold">USD Coin</p>
              </div>
            </div>

            <ol className="mt-6 space-y-2.5">
              {bountySteps.map(({ title, detail, icon: Icon, className }, index) => (
                <li
                  key={title}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl bg-muted/70 p-3.5 ring-1 ring-border/60"
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${className}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-foreground">{title}</p>
                    <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{detail}</p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">0{index + 1}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
