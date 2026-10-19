'use client';

import {
  Send,
  Headphones,
  CheckCircle2,
  AlertCircle,
  Clock,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Navbar from '@/app/components/layout/Navbar';
import { createClient } from '@/lib/supabase/client';

import type { User } from '@supabase/supabase-js';

export default function SupportPage() {
  const [user, setUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    githubUsername: '',
    companyOrProject: '',
    subject: '',
    category: 'general',
    message: '',
  });
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

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
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setUploadedImage(base64);
        setImagePreview(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setUploadedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          attachment: uploadedImage,
        }),
      });

      if (!response.ok) throw new Error('Failed to send support request');

      setSubmitStatus('success');
      setFormData({
        name: '',
        email: '',
        githubUsername: '',
        companyOrProject: '',
        subject: '',
        category: 'general',
        message: '',
      });
      removeImage();
      setTimeout(() => setSubmitStatus('idle'), 5000);
    } catch {
      setSubmitStatus('error');
      setTimeout(() => setSubmitStatus('idle'), 5000);
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

        <main className="relative z-10 flex-1 px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-2xl space-y-12">
            {/* Hero Section */}
            <section className="space-y-4 text-center">
              <div className="inline-flex items-center justify-center rounded-full bg-primary/10 px-3 py-1.5">
                <Headphones className="h-4 w-4 text-primary" aria-hidden="true" />
                <span className="ml-2 text-xs font-semibold text-primary">24/7 Support</span>
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Get Help, Fast
                </h1>
                <p className="text-sm sm:text-base text-muted-foreground">
                  We're here to support your bounty journey. Fill out the form below and we'll
                  respond quickly.
                </p>
              </div>
            </section>

            {/* Support Form */}
            <section className="overflow-hidden rounded-2xl border border-border bg-card/40 shadow-lg backdrop-blur-sm dark:border-white/10">
              <div className="bg-gradient-to-r from-primary/5 to-primary/10 px-6 py-5 sm:px-8 sm:py-6 dark:from-primary/20 dark:to-primary/30">
                <h2 className="text-xl sm:text-2xl font-bold text-foreground">Submit Request</h2>
              </div>

              <div className="px-6 py-8 sm:px-8 sm:py-10">
                {submitStatus === 'success' && (
                  <div className="mb-6 flex items-start gap-3 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-500/15">
                    <CheckCircle2
                      className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold text-emerald-900 dark:text-emerald-300">
                        Success
                      </p>
                      <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
                        We'll get back to you shortly.
                      </p>
                    </div>
                  </div>
                )}

                {submitStatus === 'error' && (
                  <div className="mb-6 flex items-start gap-3 rounded-lg bg-red-50 p-4 dark:bg-red-500/15">
                    <AlertCircle
                      className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400 mt-0.5"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="font-semibold text-red-900 dark:text-red-300">Error</p>
                      <p className="mt-1 text-sm text-red-800 dark:text-red-200">
                        Please try again.
                      </p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name & Email */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="block text-sm font-semibold text-foreground">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        placeholder="Your name"
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-sm font-semibold text-foreground"
                      >
                        Email <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="your@email.com"
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* GitHub & Organization */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="githubUsername"
                        className="block text-sm font-semibold text-foreground flex items-center gap-1.5"
                      >
                        GitHub <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="githubUsername"
                        name="githubUsername"
                        value={formData.githubUsername}
                        onChange={handleChange}
                        required
                        placeholder="username"
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="companyOrProject"
                        className="block text-sm font-semibold text-foreground"
                      >
                        Organization or Project
                      </label>
                      <input
                        type="text"
                        id="companyOrProject"
                        name="companyOrProject"
                        value={formData.companyOrProject}
                        onChange={handleChange}
                        placeholder="Your organization or project"
                        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  {/* Category */}
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
                      <option value="general">General Question</option>
                      <option value="technical">Technical Issue</option>
                      <option value="bounty">Bounty Setup</option>
                      <option value="escrow">Escrow Help</option>
                      <option value="payment">Payment Issue</option>
                      <option value="integration">Integration</option>
                      <option value="bug">Report Bug</option>
                      <option value="feature">Feature Request</option>
                    </select>
                  </div>

                  {/* Subject - Larger */}
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
                      placeholder="What is this about?"
                      className="mt-1.5 block w-full rounded-lg border border-border bg-background px-4 py-3 text-base text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Message */}
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
                      className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder-muted-foreground shadow-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  {/* Image Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      Attachment <span className="text-muted-foreground text-xs">(optional)</span>
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />

                    {imagePreview ? (
                      <div className="relative rounded-lg border-2 border-primary/30 bg-primary/5 p-4 dark:bg-primary/10">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <ImageIcon
                              className="h-5 w-5 text-primary flex-shrink-0"
                              aria-hidden="true"
                            />
                            <span className="text-sm font-medium text-foreground">
                              Media attached
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={removeImage}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          >
                            <X className="h-4 w-4 text-red-500" aria-hidden="true" />
                          </button>
                        </div>
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="max-h-40 w-full rounded object-cover"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-background/50 px-4 py-8 sm:py-10 text-center hover:border-primary hover:bg-primary/5 transition-all cursor-pointer"
                      >
                        <Upload
                          className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div>
                          <p className="text-sm font-medium text-foreground">Click to upload</p>
                          <p className="text-xs text-muted-foreground mt-1">Images or videos</p>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    <Send size={18} aria-hidden="true" />
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </button>

                  {/* Response Time Note */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 rounded-lg bg-accent p-3 sm:p-4 text-xs sm:text-sm">
                    <Clock
                      className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 text-primary mt-0.5"
                      aria-hidden="true"
                    />
                    <p className="text-foreground">
                      <span className="font-semibold">Response Time:</span> We respond within 24
                      hours on business days. For urgent matters, reach out via community.
                    </p>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </main>
      </div>
    </>
  );
}
