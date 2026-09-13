import Link from 'next/link';
import { FaGithub, FaLinkedinIn, FaXTwitter } from 'react-icons/fa6';
import Logo from './Logo';
import FooterHealth from './FooterHealth';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

const productLinks = [
  { label: 'Home', href: '/' },
  { label: 'Docs', href: '/docs' },
  { label: 'Dashboard', href: '/dashboard' },
];

const socialLinks = [
  { label: 'X', href: 'https://x.com/Trustless_OSS', icon: FaXTwitter },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/trustless-oss', icon: FaLinkedinIn },
  { label: 'GitHub', href: 'https://github.com/Trustless-OSS', icon: FaGithub },
];

export default function Footer() {
  return (
    <footer
      id="site-footer"
      className="site-footer relative z-10 mt-auto px-4 py-10 sm:px-6 lg:px-8"
    >
      <div className="mx-auto grid w-full max-w-[96rem] gap-10 md:grid-cols-[1.4fr_0.7fr_0.7fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-2xl font-semibold tracking-tight">
              Trustless <span className="text-primary">OSS</span>
            </span>
          </Link>
          <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Escrow-backed GitHub bounties. Fund the work, merge the proof, and release USDC without
            payout admin.
          </p>
          <div className="mt-5">
            <FooterHealth />
          </div>
        </div>

        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Product
          </p>
          <nav className="mt-4 flex flex-col gap-2" aria-label="Footer product links">
            {productLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition hover:text-primary"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
            Community
          </p>
          <nav className="mt-4 flex items-center gap-2" aria-label="Footer social links">
            {socialLinks.map(({ label, href, icon: Icon }) => (
              <Button key={label} variant="outline" size="icon" className="rounded-md" asChild>
                <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </a>
              </Button>
            ))}
          </nav>
          <Separator className="mt-6 mb-4 max-w-xs" />
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Trustless OSS · Made with{' '}
            <span className="text-red-500">♥</span> by{' '}
            <a
              href="https://github.com/ryzen-xp"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary"
            >
              Ryzen-XP
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
