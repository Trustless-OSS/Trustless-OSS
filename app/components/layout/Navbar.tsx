'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogIn } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import Logo from './Logo';
import Button from '@/app/components/ui/Button';
import AccountBar from './AccountBar';

interface NavbarProps {
  user?: User | null;
}

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname() ?? '/';
  const showSignIn = !user && pathname !== '/login';

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/75 backdrop-blur-xl dark:border-white/10 dark:bg-background/80">
      <div className="mx-auto flex h-20 max-w-[96rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="Trustless OSS"
          className="flex min-w-0 items-center gap-2 sm:gap-2.5 lg:gap-3"
        >
          <Logo size="nav" />
          <span className="nav-wordmark font-display font-bold">
            <span className="nav-wordmark-name">Trustless</span>{' '}
            <span className="nav-wordmark-oss">OSS</span>
          </span>
        </Link>

        <div className="flex items-center">
          {user ? (
            <AccountBar user={user} />
          ) : showSignIn ? (
            <Button href="/login" size="sm">
              <LogIn className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
              Sign in
            </Button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
