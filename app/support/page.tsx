'use client';

import {
  Send,
  Headphones,
  Clock,
  Upload,
  X,
  Image as ImageIcon,
  Video,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import Navbar from '@/app/components/layout/Navbar';
import { createClient } from '@/lib/supabase/client';
import { isSupportCategory, SUPPORT_CATEGORIES, type SupportCategory } from '@/lib/support';

import type { User } from '@supabase/supabase-js';

export default function SupportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<{
    org: string;
    category: SupportCategory;
    subject: string;
    message: string;
  }>({
    org: '',
    category: 'general',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachment, setAttachment] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<'image' | 'video' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const getUser = async () => {
      const supabase = await createClient();
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
    };
    getUser();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'category') {
      if (isSupportCategory(value)) {
        setFormData((prev) => ({ ...prev, category: value }));
      }
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      toast.error('Unsupported attachment', {
        description: 'Choose an image or video file.',
      });
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        toast.error('Could not read this file', {
          description: 'Please try another image or video.',
        });
        return;
      }
      setAttachment(reader.result);
      setAttachmentType(file.type.startsWith('image/') ? 'image' : 'video');
    };
    reader.onerror = () =>
      toast.error('Could not read this file', {
        description: 'Please try another image or video.',
      });
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Get the auth token
      const supabase = await createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('You must be logged in to send a support ticket');
      }

      // Validate field lengths
      if (formData.category.trim().length === 0 || formData.category.trim().length > 100) {
        throw new Error('Category is required and must be 100 characters or less');
      }
      if (formData.subject.trim().length === 0 || formData.subject.trim().length > 200) {
        throw new Error('Subject is required and must be 200 characters or less');
      }
      if (formData.message.trim().length === 0 || formData.message.trim().length > 10000) {
        throw new Error('Message is required and must be 10,000 characters or less');
      }
      if (formData.org.trim().length > 200) {
        throw new Error('Project name must be 200 characters or less');
      }

      let attachmentKey: string | undefined;

      // Upload attachment if present
      if (attachment) {
        const uploadFormData = new FormData();

        // Convert base64 data URL to blob
        const [header, data] = attachment.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
        const binary = atob(data);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([array], { type: mimeType });

        const fileName = `support-${Date.now()}${mimeType === 'image/png' ? '.png' : mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'video/mp4' ? '.mp4' : '.dat'}`;
        uploadFormData.append('file', blob, fileName);

        const uploadResponse = await fetch('/api/backend/upload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: uploadFormData,
        });

        if (!uploadResponse.ok) {
          throw new Error('Failed to upload attachment');
        }

        const uploadResult = (await uploadResponse.json()) as Record<string, unknown>;
        attachmentKey = (uploadResult.key || uploadResult.url || uploadResult.path) as
          string | undefined;

        if (!attachmentKey || attachmentKey.length > 1024) {
          throw new Error('Attachment key is invalid or too long (max 1024 chars)');
        }
      }

      const requestBody = {
        category: formData.category,
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        bountyId: null,
        ...(formData.org.trim().length > 0 && formData.org.trim().length <= 200
          ? { org: formData.org.trim() }
          : {}),
        ...(attachmentKey && attachmentKey.length <= 1024 ? { attachmentKey } : {}),
      };

      const response = await fetch('/api/backend/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? 'Please try again in a moment.');
      }

      setFormData({
        org: '',
        category: 'general',
        subject: '',
        message: '',
      });
      removeAttachment();
      toast.success('Your request has been sent', {
        description: "Thanks for reaching out. We'll get back to you shortly.",
      });
    } catch (error) {
      toast.error("We couldn't send your request", {
        description: error instanceof Error ? error.message : 'Please try again in a moment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Navbar user={user} />
      <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
        {/* Aurora Background */}
        <div className="page-aurora pointer-events-none fixed inset-0 z-0" aria-hidden="true">
          <span className="page-aurora-one" />
          <span className="page-aurora-two" />
          <span className="page-aurora-three" />
        </div>

        <main className="relative z-10 flex-1 px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-6xl space-y-9 sm:space-y-12">
            {/* Hero Section */}
            <section className="mx-auto max-w-3xl space-y-5 text-center">
              <div className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-xs font-semibold tracking-wide text-primary shadow-sm">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                HERE WHEN YOU NEED US
              </div>
              <div className="space-y-3">
                <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                  Let's get you <span className="text-primary">unstuck.</span>
                </h1>
                <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Tell us what's going on and our team will help you get back to building.
                </p>
              </div>
            </section>

            <div className="mx-auto max-w-3xl space-y-6">
              <section className="overflow-hidden rounded-2xl border border-border bg-card/80 shadow-xl shadow-primary/5 backdrop-blur-sm">
                <div className="border-b border-border bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-5 sm:px-8 sm:py-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                      <Headphones className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground sm:text-xl">
                        Send us a message
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Fields marked * are required
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-5 py-6 sm:px-8 sm:py-8">
                  <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                    <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
                      <div>
                        <label
                          htmlFor="org"
                          className="block text-sm font-semibold text-foreground"
                        >
                          Project Name
                        </label>
                        <input
                          type="text"
                          id="org"
                          name="org"
                          value={formData.org}
                          onChange={handleChange}
                          maxLength={200}
                          placeholder="Your project or org. name (optional)"
                          className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formData.org.length}/200
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="category"
                          className="block text-sm font-semibold text-foreground"
                        >
                          Category <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="category"
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                          className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {SUPPORT_CATEGORIES.map(({ value, label }) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="subject"
                        className="block text-sm font-semibold text-foreground"
                      >
                        Subject <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleChange}
                        required
                        maxLength={200}
                        placeholder="What is this about?"
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formData.subject.length}/200
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="message"
                        className="block text-sm font-semibold text-foreground"
                      >
                        Message <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        required
                        placeholder="Tell us what you need..."
                        rows={5}
                        maxLength={10000}
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formData.message.length}/10000
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="attachment"
                        className="mb-2 block text-sm font-semibold text-foreground"
                      >
                        Attachment <span className="text-xs text-muted-foreground">(optional)</span>
                      </label>
                      <input
                        ref={fileInputRef}
                        id="attachment"
                        type="file"
                        accept="image/*,video/*"
                        onChange={handleAttachmentChange}
                        className="sr-only"
                      />
                      {attachment ? (
                        <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4 dark:bg-primary/10">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                              {attachmentType === 'video' ? (
                                <Video className="h-5 w-5 text-primary" aria-hidden="true" />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                              )}
                              <span>
                                {attachmentType === 'video' ? 'Video attached' : 'Image attached'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={removeAttachment}
                              aria-label="Remove attachment"
                              className="rounded p-1 transition-colors hover:bg-red-100 dark:hover:bg-red-900/30"
                            >
                              <X className="h-4 w-4 text-red-500" aria-hidden="true" />
                            </button>
                          </div>
                          {attachmentType === 'video' ? (
                            <video src={attachment} controls className="max-h-60 w-full rounded">
                              Your browser does not support video playback.
                            </video>
                          ) : (
                            <img
                              src={attachment}
                              alt="Attachment preview"
                              className="max-h-60 w-full rounded object-contain"
                            />
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-background/50 px-4 py-8 text-center transition-all hover:border-primary hover:bg-primary/5"
                        >
                          <Upload className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                          <span>
                            <span className="block text-sm font-medium text-foreground">
                              Click to upload
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              Images or videos
                            </span>
                          </span>
                        </button>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full min-h-12 inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 text-sm sm:text-base"
                    >
                      <Send size={18} aria-hidden="true" />
                      {isSubmitting ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                </div>
              </section>

              <section
                aria-label="Support notes"
                className="grid gap-5 border-t border-border/70 pt-6 sm:grid-cols-2 sm:gap-8"
              >
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <h3 className="font-semibold text-foreground">A real human, soon</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      We usually respond within 24 hours on business days. Include the details that
                      will help us understand your issue.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ShieldCheck
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="font-semibold text-foreground">Your information stays safe</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Only share what's needed to resolve your request. Never include passwords,
                      recovery phrases, or private keys.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
