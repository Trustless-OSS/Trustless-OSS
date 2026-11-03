'use client';

import { useRef, useState } from 'react';
import {
  ArrowUpRight,
  Check,
  GitPullRequest,
  LoaderCircle,
  Rocket,
  Sparkles,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';

interface WaitlistDialogProps {
  open: boolean;
  onClose: () => void;
}

const inputClass =
  'mt-2 block w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-base text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:opacity-60';

export default function WaitlistDialog({ open, onClose }: WaitlistDialogProps) {
  const [formData, setFormData] = useState({ name: '', email: '', feedback: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const titleRef = useRef<HTMLHeadingElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!formData.name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim(),
          ...(formData.feedback.trim() ? { feedback: formData.feedback.trim() } : {}),
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Please try again in a moment.');
      }

      toast.success("You're on the list!", {
        description: `We'll email ${formData.email.trim()} when mainnet goes live.`,
      });
      setFormData({ name: '', email: '', feedback: '' });
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again in a moment.';
      setError(message);
      toast.error('Registration failed', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        className="flex! max-h-[calc(100dvh-1.5rem)] max-w-[calc(100%-1.5rem)]! flex-col gap-0! overflow-hidden! rounded-xl! border border-border bg-card p-0! shadow-2xl shadow-black/20 sm:max-h-[calc(100dvh-3rem)] sm:max-w-[820px]!"
      >
        <DialogClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close waitlist"
            className="absolute right-3 top-3 z-20 bg-card/95 text-muted-foreground shadow-sm ring-1 ring-border backdrop-blur-sm hover:bg-muted hover:text-foreground sm:right-4 sm:top-4"
          >
            <X className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </DialogClose>
        <div className="min-h-0 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
          <div className="grid min-w-0 md:grid-cols-[0.85fr_1.15fr]">
            <div className="relative isolate overflow-hidden border-b border-border bg-primary/[0.06] px-5 py-5 pr-16 sm:px-8 sm:py-7 sm:pr-20 md:flex md:pr-8 md:flex-col md:border-r md:border-b-0 md:p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -left-20 -top-20 -z-10 size-72 rounded-full bg-primary/10 blur-3xl"
              />
              <div className="mb-6 hidden size-12 md:flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-lg shadow-primary/20 md:mb-10 md:size-14">
                <Rocket className="size-6" aria-hidden="true" />
              </div>
              <span className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-primary uppercase">
                <Sparkles className="size-3.5" aria-hidden="true" /> The next chapter
              </span>
              <DialogTitle
                ref={titleRef}
                tabIndex={-1}
                className="max-w-xs text-2xl outline-none font-bold leading-[1.1] tracking-tight sm:text-4xl"
              >
                Build together.
                <br />
                <span className="text-primary">Get rewarded.</span>
              </DialogTitle>
              <DialogDescription className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                Be first in line when Trustless OSS launches on mainnet. Open-source work, with
                rewards built in.
              </DialogDescription>
              <div className="mt-8 hidden rounded-lg border border-primary/15 bg-card/80 p-4 md:block">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <GitPullRequest className="size-4 text-primary" aria-hidden="true" /> From
                  contribution to reward
                </div>
                <div className="mt-4 space-y-3">
                  {[
                    'Find an issue worth building',
                    'Ship a pull request',
                    'Earn USDC for your work',
                  ].map((label) => (
                    <p
                      key={label}
                      className="flex items-center gap-2.5 text-xs leading-5 text-muted-foreground"
                    >
                      <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      {label}
                    </p>
                  ))}
                </div>
              </div>
              <p className="mt-auto hidden pt-8 text-xs font-medium text-muted-foreground md:block">
                Built for the people who build open source.
              </p>
            </div>

            <div className="min-w-0 px-5 py-5 sm:px-8 sm:py-7 md:pt-16">
              <h3 className="hidden text-xl font-bold tracking-tight text-foreground md:block">
                Your spot starts here.
              </h3>
              <p className="mt-2 hidden text-sm leading-6 text-muted-foreground md:block">
                Leave your details. We’ll let you know when it’s time.
              </p>
              <form
                onSubmit={handleSubmit}
                className="space-y-4 md:mt-6 md:space-y-5"
                aria-busy={isSubmitting}
              >
                <fieldset disabled={isSubmitting} className="min-w-0 space-y-4 md:space-y-5">
                  <div>
                    <label htmlFor="wl-name" className="text-sm font-semibold text-foreground">
                      Your name
                    </label>
                    <input
                      type="text"
                      id="wl-name"
                      name="name"
                      autoComplete="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      maxLength={120}
                      placeholder="Ada Lovelace"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="wl-email" className="text-sm font-semibold text-foreground">
                      Email address
                    </label>
                    <input
                      type="email"
                      id="wl-email"
                      name="email"
                      autoComplete="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      maxLength={254}
                      placeholder="ada@example.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="wl-feedback" className="text-sm font-semibold text-foreground">
                      What would you love to see?{' '}
                      <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <textarea
                      id="wl-feedback"
                      name="feedback"
                      value={formData.feedback}
                      onChange={handleChange}
                      rows={2}
                      maxLength={1000}
                      placeholder="An idea, a feature, or what you’re building…"
                      className={`${inputClass} min-h-20 resize-y md:min-h-24`}
                    />
                  </div>
                </fieldset>
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-300"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:bg-primary/90 hover:shadow-primary/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <LoaderCircle
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                      Joining the waitlist…
                    </>
                  ) : (
                    <>
                      Join the waitlist
                      <ArrowUpRight
                        className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transform-none"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
                <p className="text-center text-xs leading-5 text-muted-foreground">
                  We’ll email you when mainnet goes live.
                </p>
              </form>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
