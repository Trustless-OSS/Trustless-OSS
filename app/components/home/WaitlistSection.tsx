'use client';

import { useState } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

export default function WaitlistSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg('Please enter a valid email address.');
      setStatus('error');
      return;
    }

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Something went wrong. Please try again.');
      }

      setStatus('success');
      setEmail('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  return (
    <section
      className="landing-spotlight relative mb-20 overflow-hidden rounded-3xl px-5 py-10 sm:px-10 sm:py-14 md:mb-28"
      aria-labelledby="waitlist-title"
    >
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Early access
        </div>

        <h2
          id="waitlist-title"
          className="font-display mt-5 text-3xl font-extrabold leading-[0.98] tracking-tight text-foreground sm:text-4xl md:text-5xl"
        >
          Be first to ship
          <br />
          <span className="text-primary">paid bounties.</span>
        </h2>

        <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
          Join the waitlist and get early access when we open the next cohort.
        </p>

        {status === 'success' ? (
          <div className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-100 px-6 py-4 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/20">
            <span className="text-base">🎉</span>
            You&apos;re on the list! We&apos;ll be in touch.
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start"
            noValidate
          >
            <div className="flex-1">
              <label htmlFor="waitlist-email" className="sr-only">
                Email address
              </label>
              <input
                id="waitlist-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                placeholder="you@example.com"
                required
                maxLength={254}
                disabled={status === 'loading'}
                aria-describedby={status === 'error' ? 'waitlist-error' : undefined}
                aria-invalid={status === 'error'}
                className="block w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20"
              />
              {status === 'error' && (
                <p id="waitlist-error" className="mt-1.5 text-left text-xs text-destructive">
                  {errorMsg}
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === 'loading' ? (
                'Joining…'
              ) : (
                <>
                  Join waitlist
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
