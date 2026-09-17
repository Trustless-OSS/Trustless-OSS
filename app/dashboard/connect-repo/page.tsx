'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GitBranch } from 'lucide-react';
import { SiGithub } from 'react-icons/si';
import { fetchBackendHealth } from '@/lib/health';
import Button from '@/app/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';

// [ryzen-xp] : same-tab GitHub App install (no popup)
export default function ConnectRepoPage() {
  const router = useRouter();

  useEffect(() => {
    void fetchBackendHealth(10_000);
  }, []);

  const handleInstall = () => {
    const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'Trustless-OSS';
    // Same tab — GitHub redirects back to the dApp setup URL after install.
    window.open(`https://github.com/apps/${slug}/installations/new`, '_self');
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="flex w-full flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center px-3 py-8 sm:px-5 md:px-6 md:py-12">
        <Card className="relative w-full max-w-lg rounded-3xl py-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="absolute top-4 left-4 z-20 h-10 w-10 rounded-md px-0"
            aria-label="Go back"
          >
            <ArrowLeft size={20} strokeWidth={3} aria-hidden="true" />
          </Button>

          <CardContent className="px-5 pt-14 pb-8 text-center sm:px-8 sm:pt-16 sm:pb-10 md:px-10">
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Connect repository
            </p>

            <span className="mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <GitBranch className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
            </span>

            <h1 className="font-display mt-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Install the GitHub App
            </h1>

            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
              Connect a repository by installing the Trustless OSS GitHub App and choosing which
              repos to grant access. You will return here afterward to sync them one by one.
            </p>

            <Button
              type="button"
              onClick={handleInstall}
              className="mt-8 h-12 w-full gap-3"
              size="lg"
            >
              <SiGithub className="h-5 w-5" aria-hidden="true" />
              <span>Install GitHub App</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
