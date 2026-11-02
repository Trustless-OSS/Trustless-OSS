import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, GitBranch, Home, LayoutDashboard, MapPinOff, SearchX } from 'lucide-react';
import Button from '@/app/components/ui/Button';
import Logo from '@/app/components/layout/Logo';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import styles from './not-found.module.css';

export const metadata: Metadata = {
  title: 'Page not found | Trustless OSS',
  description: 'The requested Trustless OSS page could not be found.',
};

const routeHints = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/repos', label: 'Repositories' },
  { href: '/support', label: 'Support' },
];

export default function NotFound() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" aria-label="Trustless OSS home" className={styles.brand}>
          <Logo size="nav" />
          <span className="nav-wordmark font-display font-bold max-[400px]:text-base!">
            <span className="nav-wordmark-name">Trustless</span>{' '}
            <span className="nav-wordmark-oss">OSS</span>
          </span>
        </Link>

        <Badge variant="outline" className={styles.statusBadge}>
          <span className={styles.statusDot} aria-hidden="true" />
          Route not found
        </Badge>
      </header>

      <main className={styles.main}>
        <section className={styles.copy} aria-labelledby="not-found-title">
          <Badge variant="secondary" className={styles.eyebrow}>
            <MapPinOff aria-hidden="true" />
            Error 404
          </Badge>

          <div className={styles.errorCode} aria-hidden="true">
            404
          </div>

          <h1 id="not-found-title" className={styles.title}>
            This branch doesn&apos;t exist.
          </h1>
          <p className={styles.description}>
            The page may have been moved, merged, or never committed. Let&apos;s get you back to a
            route that ships.
          </p>

          <div className={styles.actions}>
            <Button href="/" size="lg" className={styles.primaryAction}>
              <Home aria-hidden="true" />
              Back to home
            </Button>
            <Button
              href="/dashboard"
              variant="outline"
              size="lg"
              className={styles.secondaryAction}
            >
              <LayoutDashboard aria-hidden="true" />
              Open dashboard
            </Button>
          </div>

          <nav className={styles.routeHints} aria-label="Useful pages">
            <span>Try another route</span>
            {routeHints.map((route) => (
              <Link key={route.href} href={route.href}>
                {route.label}
              </Link>
            ))}
          </nav>
        </section>

        <Card className={styles.routeCard} aria-label="Lost repository branch illustration">
          <CardHeader className={styles.cardHeader}>
            <div>
              <p className={styles.cardKicker}>Repository navigator</p>
              <p className={styles.cardTitle}>Searching for route...</p>
            </div>
            <Badge variant="outline" className={styles.cardBadge}>
              <SearchX aria-hidden="true" />
              No match
            </Badge>
          </CardHeader>

          <CardContent className={styles.cardContent}>
            <div className={styles.branchMap} aria-hidden="true">
              <svg viewBox="0 0 520 300" preserveAspectRatio="xMidYMid meet">
                <path className={styles.branchBase} d="M54 246 C128 246 142 183 212 183 H466" />
                <path className={styles.branchActive} d="M54 246 C128 246 142 183 212 183 H466" />
                <path className={styles.branchLost} d="M188 183 C233 183 222 83 300 83 H438" />
              </svg>

              <span className={`${styles.node} ${styles.nodeStart}`}>
                <GitBranch />
              </span>
              <span className={`${styles.node} ${styles.nodeMerge}`} />
              <span className={`${styles.node} ${styles.nodeEnd}`}>
                <Home />
              </span>
              <span className={`${styles.node} ${styles.nodeLost}`}>
                <SearchX />
              </span>

              <span className={`${styles.branchLabel} ${styles.mainLabel}`}>main</span>
              <span className={`${styles.branchLabel} ${styles.lostLabel}`}>requested-page</span>
              <span className={styles.floatingCode}>404</span>
            </div>

            <div className={styles.trace}>
              <span className={styles.traceIcon}>
                <ArrowLeft aria-hidden="true" />
              </span>
              <div>
                <p>Safe route available</p>
                <span>Return to main and keep exploring Trustless OSS.</span>
              </div>
              <Badge className={styles.readyBadge}>Ready</Badge>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
