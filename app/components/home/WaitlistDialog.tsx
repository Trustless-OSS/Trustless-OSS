'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Rocket } from 'lucide-react';
import { toast } from 'sonner';

interface WaitlistDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function WaitlistDialog({ open, onClose }: WaitlistDialogProps) {
  const [formData, setFormData] = useState({ name: '', email: '', feedback: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) firstInputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/backend/waitlist', {
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
      onClose();
    } catch (err) {
      toast.error('Registration failed', {
        description: err instanceof Error ? err.message : 'Please try again in a moment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-dialog-title"
    >
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-primary/10">
        {/* Header */}
        <div className="border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                <Rocket className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="waitlist-dialog-title"
                  className="text-base font-bold text-foreground sm:text-lg"
                >
                  Get early access
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  First in line when we launch on mainnet
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-6 sm:px-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4">
              <div>
                <label htmlFor="wl-name" className="block text-sm font-semibold text-foreground">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  ref={firstInputRef}
                  type="text"
                  id="wl-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  maxLength={120}
                  placeholder="Ada Lovelace"
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div>
                <label htmlFor="wl-email" className="block text-sm font-semibold text-foreground">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="wl-email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  maxLength={254}
                  placeholder="ada@example.com"
                  className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="wl-feedback" className="block text-sm font-semibold text-foreground">
                Anything you'd like to see at launch?{' '}
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </label>
              <textarea
                id="wl-feedback"
                name="feedback"
                value={formData.feedback}
                onChange={handleChange}
                rows={2}
                maxLength={1000}
                placeholder="e.g. GitLab support, multi-token payouts…"
                className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting…' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
