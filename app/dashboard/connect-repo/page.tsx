'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, GitBranch, RefreshCw } from 'lucide-react';
import { SiGithub } from 'react-icons/si';
import {
  GITHUB_INSTALL_FAILED,
  GITHUB_INSTALL_WINDOW_NAME,
  isGitHubInstallFailedMessage,
  isGitHubInstallSuccessMessage,
  subscribeGitHubInstallResult,
} from '@/lib/github-install';
import { handleError } from '@/lib/notifications';
import { fetchBackendHealth } from '@/lib/health';
import Button from '@/app/components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';

export default function ConnectRepoPage() {
  const router = useRouter();
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    void fetchBackendHealth(20_000);
  }, []);

  useEffect(() => {
    let lastMessage = '';
    let lastAt = 0;

    return subscribeGitHubInstallResult((data) => {
      if (isGitHubInstallSuccessMessage(data)) {
        router.push('/dashboard/repos');
        return;
      }

      if (data === GITHUB_INSTALL_FAILED || isGitHubInstallFailedMessage(data)) {
        const message = isGitHubInstallFailedMessage(data)
          ? data.message
          : 'GitHub installed the app, but the API could not sync it.';
        const now = Date.now();
        if (message === lastMessage && now - lastAt < 2000) {
          return;
        }
        lastMessage = message;
        lastAt = now;
        setInstalling(false);
        handleError(message, 'Connect repository');
      }
    });
  }, [router]);

  const handleInstall = () => {
    if (installing) return;

    setInstalling(true);
    const slug = process.env.NEXT_PUBLIC_GITHUB_APP_SLUG || 'Trustless-OSS';
    window.open(
      `https://github.com/apps/${slug}/installations/new`,
      GITHUB_INSTALL_WINDOW_NAME,
      'width=600,height=800,scrollbars=yes'
    );
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
              {installing ? (
                <RefreshCw className="h-7 w-7 animate-spin" strokeWidth={2.5} aria-hidden="true" />
              ) : (
                <GitBranch className="h-7 w-7" strokeWidth={2.5} aria-hidden="true" />
              )}
            </span>

            <h1 className="font-display mt-6 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {installing ? 'Waiting for installation' : 'Install the GitHub App'}
            </h1>

            <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground sm:text-base">
              {installing
                ? 'Finish installing the app in the GitHub popup. This page will update when the connection is complete.'
                : 'Connect a repository by installing the Trustless OSS GitHub App and choosing which repos to grant access.'}
            </p>

            <Button
              type="button"
              onClick={handleInstall}
              disabled={installing}
              aria-busy={installing}
              className="mt-8 h-12 w-full gap-3"
              size="lg"
            >
              {installing ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" strokeWidth={3} aria-hidden="true" />
                  <span>Waiting for GitHub...</span>
                </>
              ) : (
                <>
                  <SiGithub className="h-5 w-5" aria-hidden="true" />
                  <span>Install GitHub App</span>
                </>
              )}
            </Button>

            {installing && (
              <p
                className="mt-5 font-mono text-[11px] font-bold tracking-[0.18em] text-primary uppercase"
                role="status"
                aria-live="polite"
              >
                Keep this tab open
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
