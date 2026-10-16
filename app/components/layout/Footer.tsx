import Link from 'next/link';
import { FaLinkedinIn, FaXTwitter } from 'react-icons/fa6';
import Logo from './Logo';
import FooterHealth from './FooterHealth';
import { Separator } from '@/components/ui/separator';

const resourceLinks = [
  { label: 'Website', href: '/' },
  { label: 'Docs', href: '/docs' },
  { label: 'Dashboard', href: '/dashboard' },
];

const supportLinks = [
  { label: 'Get Help', href: '/support' },
  { label: 'FAQ', href: '/faq' },
];

const connectLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/trustless-oss', icon: FaLinkedinIn },
  { label: 'X (Twitter)', href: 'https://x.com/Trustless_OSS', icon: FaXTwitter },
];

export default function Footer() {
  return (
    <footer
      id="site-footer"
      className="site-footer relative z-10 mt-auto px-4 py-12 sm:px-6 lg:px-8"
    >
      <div className="mx-auto w-full max-w-[96rem]">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <Link href="/" aria-label="Trustless OSS" className="inline-flex items-center gap-3">
              <Logo size="sm" />
              <span className="font-display text-2xl font-bold tracking-tight">
                Trustless <span className="text-primary">OSS</span>
              </span>
            </Link>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              Escrow-backed GitHub bounties on the Stellar ecosystem. For the community, by the
              community.
            </p>
          </div>

          <FooterColumn title="Resources">
            {resourceLinks.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Support">
            {supportLinks.map((link) => (
              <FooterLink key={link.href} href={link.href}>
                {link.label}
              </FooterLink>
            ))}
          </FooterColumn>

          <FooterColumn title="Connect">
            {connectLinks.map(({ label, href, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </a>
            ))}
          </FooterColumn>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center gap-4 text-xs text-muted-foreground sm:flex-row sm:justify-between">
          <p className="order-2 sm:order-1">
            © {new Date().getFullYear()} Trustless OSS. All rights reserved.
          </p>

          <div className="order-1 flex items-center gap-6 sm:order-2">
            <FooterHealth />
          </div>

          <p className="order-3">
            Built with <span className="text-red-500">♥</span> for OSS{' '}
            <span className="text-muted-foreground/50">|</span>{' '}
            <a
              href="https://github.com/ryzen-xp"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              ryzen-xp
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <nav className="mt-4 flex flex-col gap-3" aria-label={`Footer ${title.toLowerCase()} links`}>
        {children}
      </nav>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
    >
      {children}
    </Link>
  );
}
