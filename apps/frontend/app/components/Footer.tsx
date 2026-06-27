import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import AnimatedLogo from './AnimatedLogo';

const footerLinks = [
  {
    label: 'Docs',
    href: '/docs',
    external: false,
  },
  {
    label: 'Security',
    href: 'https://docs.trustlessoss.io/security',
    external: true,
  },
  {
    label: 'Issues',
    href: 'https://github.com/Trustless-OSS/Trustless-OSS/issues',
    external: true,
  },
  {
    label: 'Support',
    href: 'mailto:support@trustlessoss.io',
    external: true,
  },
];

export default function Footer() {
  return (
    <footer className="relative z-10 border-t-[4px] border-slate-950 bg-slate-50 px-3 py-5 sm:px-4 md:px-5">
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-3">
              <AnimatedLogo size="sm" />
              <div className="min-w-0">
                <div className="title-brutal text-2xl tracking-tighter text-slate-950">
                  TRUSTLESS <span className="text-blue-600">OSS</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 font-mono text-[0.72rem] font-bold uppercase tracking-[0.16em] text-slate-700">
            {footerLinks.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                  rel={link.href.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                  className="inline-flex items-center gap-1.5 border-2 border-slate-950 bg-white px-3 py-2 transition-colors hover:bg-slate-950 hover:text-white"
                >
                  <span>{link.label}</span>
                  {!link.href.startsWith('mailto:') && <ArrowUpRight className="h-3.5 w-3.5" />}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 border-2 border-slate-950 bg-white px-3 py-2 transition-colors hover:bg-slate-950 hover:text-white"
                >
                  <span>{link.label}</span>
                </Link>
              )
            )}

            <div className="inline-flex items-center gap-2 border-2 border-slate-950 bg-blue-600 px-3 py-2 text-white">
              <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-80" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <span>Operational</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t-2 border-dashed border-slate-300 pt-3 font-mono text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Trustless OSS</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>Built for automated contributor payouts</span>
            <a
              href="https://github.com/ryzen-xp"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-700 transition-colors hover:text-blue-600"
            >
              Ryzen-XP
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
