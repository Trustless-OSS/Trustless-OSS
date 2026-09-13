'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import LoadingLogo from '../components/layout/LoadingLogo';
import { handleError } from '@/lib/notifications';
import Button from '@/app/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function safeNextPath(value: string | null): string {
  if (value && value.startsWith('/') && !value.startsWith('//')) {
    return value;
  }
  return '/dashboard';
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('error') === 'auth_failed') {
      handleError('GitHub sign-in failed. Please try again.', 'Authenticate');
    }
  }, [searchParams]);

  async function handleLogin() {
    setLoading(true);
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const next = safeNextPath(searchParams.get('next'));
      document.cookie = `auth_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'read:user user:email',
        },
      });

      if (error) {
        throw error;
      }

      if (data.url) {
        window.location.assign(data.url);
        return;
      }

      throw new Error('GitHub did not return a sign-in URL.');
    } catch (e) {
      handleError(e, 'GitHub login');
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <Card className="relative w-full max-w-md rounded-3xl py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="absolute top-4 right-4 h-9 w-9 rounded-md px-0"
          aria-label="Go back"
        >
          <X size={18} strokeWidth={2.25} />
        </Button>

        <CardHeader className="px-8 pt-8 md:px-10 md:pt-10">
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Sign in</p>
          <CardTitle className="font-display mt-3 text-3xl font-extrabold tracking-tight">
            Authenticate
          </CardTitle>
          <CardDescription className="mt-1 text-sm leading-6">
            Connect GitHub to manage repositories, escrow pools, and contributor payouts.
          </CardDescription>
        </CardHeader>

        <CardContent className="px-8 pb-8 md:px-10 md:pb-10">
          <Button
            type="button"
            onClick={handleLogin}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <LoadingLogo size="tiny" variant="circle" />
                Connecting
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                Continue with GitHub
              </>
            )}
          </Button>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            By connecting, you accept the protocol terms of service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
