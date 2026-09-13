'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Check,
  Copy,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Save,
  Sparkles,
  Unplug,
  Wallet,
  X,
} from 'lucide-react';
import { SiDiscord, SiGithub, SiTelegram, SiX } from 'react-icons/si';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getWalletKit, withTimeout, WALLET_OPERATION_TIMEOUT_MS } from '@/lib/wallet-kit';
import { handleError, notifySuccess } from '@/lib/notifications';
import Button from '@/app/components/ui/Button';
import LoadingLogo from '@/app/components/layout/LoadingLogo';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';

type ProfileForm = {
  firstName: string;
  lastName: string;
  bio: string;
  location: string;
  website: string;
  skills: string;
  telegram: string;
  discord: string;
  twitter: string;
  stellarAddress: string;
};

function splitDisplayName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  const space = trimmed.indexOf(' ');
  if (space === -1) return { firstName: trimmed, lastName: '' };
  return {
    firstName: trimmed.slice(0, space).trim(),
    lastName: trimmed.slice(space + 1).trim(),
  };
}

function fullName(form: Pick<ProfileForm, 'firstName' | 'lastName'>) {
  return `${form.firstName} ${form.lastName}`.trim();
}

/** Keep only a username — strip @, URLs, and path junk. */
function normalizeUsername(value: string) {
  let next = value.trim();
  if (!next) return '';
  next = next.replace(/^https?:\/\//i, '');
  next = next.replace(/^(www\.)?/i, '');
  next = next.replace(
    /^(t\.me|telegram\.me|x\.com|twitter\.com|discord\.com\/users|discord\.gg)\//i,
    ''
  );
  next = next.replace(/^@/, '');
  next = next.split(/[/?\s]/)[0] ?? '';
  return next.trim();
}

function profileFromUser(user: User): ProfileForm {
  const metadata = user.user_metadata ?? {};
  const githubName = metadata.user_name ?? user.email?.split('@')[0] ?? '';
  const fromMeta = {
    firstName: String(metadata.first_name ?? ''),
    lastName: String(metadata.last_name ?? ''),
  };
  const fallback = splitDisplayName(
    String(metadata.display_name ?? metadata.full_name ?? githubName)
  );

  return {
    firstName: fromMeta.firstName || fallback.firstName,
    lastName: fromMeta.lastName || fallback.lastName,
    bio: String(metadata.bio ?? ''),
    location: String(metadata.location ?? ''),
    website: String(metadata.website ?? ''),
    skills: String(metadata.skills ?? ''),
    telegram: normalizeUsername(String(metadata.telegram ?? '')),
    discord: normalizeUsername(String(metadata.discord ?? '')),
    twitter: normalizeUsername(String(metadata.twitter ?? '')),
    stellarAddress: String(metadata.stellar_address ?? ''),
  };
}

function shortenAddress(address: string) {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function parseSkills(skills: string) {
  return skills
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function profileCompleteness(form: ProfileForm, email: string) {
  const checks = [
    fullName(form),
    form.bio,
    form.location,
    form.website,
    form.skills,
    form.stellarAddress,
    email,
  ];
  const filled = checks.filter((value) => value.trim().length > 0).length;
  return { filled, total: checks.length, percent: Math.round((filled / checks.length) * 100) };
}

function formsEqual(left: ProfileForm, right: ProfileForm) {
  return (Object.keys(left) as (keyof ProfileForm)[]).every((key) => left[key] === right[key]);
}

function websiteHref(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default function ProfileSettings({ user }: { user: User }) {
  const githubName = user.user_metadata?.user_name ?? user.email?.split('@')[0] ?? 'developer';
  const avatar = user.user_metadata?.avatar_url as string | undefined;
  const initial = githubName[0]?.toUpperCase() ?? 'U';
  const [form, setForm] = useState<ProfileForm>(() => profileFromUser(user));
  const [saved, setSaved] = useState<ProfileForm>(() => profileFromUser(user));
  const [skillDraft, setSkillDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [copiedField, setCopiedField] = useState<'email' | 'wallet' | null>(null);
  const copiedTimer = useRef<number>(0);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const skills = useMemo(() => parseSkills(form.skills), [form.skills]);
  const githubEmail = user.email?.trim() ?? '';
  const completeness = useMemo(() => profileCompleteness(form, githubEmail), [form, githubEmail]);
  const dirty = useMemo(() => !formsEqual(form, saved), [form, saved]);
  const portfolio = websiteHref(form.website);
  const displayName = fullName(form) || githubName;

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateUsername(key: 'telegram' | 'discord' | 'twitter', value: string) {
    update(key, normalizeUsername(value));
  }

  function addSkill(raw = skillDraft) {
    const next = raw.trim().replace(/,$/, '');
    if (!next) return;
    if (skills.some((skill) => skill.toLowerCase() === next.toLowerCase())) {
      setSkillDraft('');
      return;
    }
    update('skills', [...skills, next].join(', '));
    setSkillDraft('');
  }

  function removeSkill(skill: string) {
    update('skills', skills.filter((item) => item !== skill).join(', '));
  }

  function nextForm() {
    const nextSkills = parseSkills(skillDraft ? `${form.skills},${skillDraft}` : form.skills);
    return { ...form, skills: nextSkills.join(', ') };
  }

  async function persist(next: ProfileForm) {
    const supabase = createClient();
    const name = fullName(next);
    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: next.firstName.trim(),
        last_name: next.lastName.trim(),
        display_name: name,
        bio: next.bio.trim(),
        location: next.location.trim(),
        website: next.website.trim(),
        skills: next.skills.trim(),
        telegram: normalizeUsername(next.telegram),
        discord: normalizeUsername(next.discord),
        twitter: normalizeUsername(next.twitter),
        stellar_address: next.stellarAddress.trim(),
      },
    });
    if (error) throw error;
    setSaved({
      ...next,
      telegram: normalizeUsername(next.telegram),
      discord: normalizeUsername(next.discord),
      twitter: normalizeUsername(next.twitter),
    });
  }

  async function handleSave() {
    const next = nextForm();
    setSaving(true);
    try {
      setForm(next);
      setSkillDraft('');
      await persist(next);
      notifySuccess('Profile saved', 'Your developer details are ready for payouts.');
    } catch (error) {
      handleError(error, 'Save profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectWallet() {
    setConnecting(true);
    try {
      const kit = await getWalletKit();
      const { address } = await withTimeout(
        kit.authModal(),
        WALLET_OPERATION_TIMEOUT_MS,
        'Wallet authorization timed out. Close the wallet modal and try again.'
      );
      if (!address) throw new Error('No Stellar public key returned');

      const next = { ...form, stellarAddress: address };
      setForm(next);
      await persist(next);
      notifySuccess('Stellar wallet connected', 'This address will be used for USDC payouts.');
    } catch (error) {
      handleError(error, 'Connect wallet');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnectWallet() {
    const next = { ...form, stellarAddress: '' };
    setForm(next);
    setSaving(true);
    try {
      await persist(next);
      notifySuccess('Wallet disconnected', 'Connect a Stellar wallet before claiming bounties.');
    } catch (error) {
      handleError(error, 'Disconnect wallet');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(field: 'email' | 'wallet', value: string, title: string) {
    try {
      await navigator.clipboard.writeText(value);
      notifySuccess(title);
      setCopiedField(field);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(
        () => setCopiedField((current) => (current === field ? null : current)),
        1600
      );
    } catch (error) {
      handleError(error, 'Copy');
    }
  }

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">Account</p>
          <h1 className="font-display mt-2 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Profile
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Add the details maintainers and payouts need from a contributor.
          </p>
        </div>
        <div className="w-full max-w-sm space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <span>Profile completeness</span>
            <span>{completeness.percent}%</span>
          </div>
          <Progress
            value={completeness.percent}
            className="h-2"
            aria-label="Profile completeness"
          />
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <Card className="overflow-hidden rounded-3xl py-0">
            <div className="relative h-40 overflow-hidden bg-gradient-to-br from-blue-700 via-primary to-violet-600">
              <span className="absolute -top-10 -right-6 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
              <span className="absolute -bottom-8 left-16 h-28 w-28 rounded-full bg-cyan-300/25 blur-xl" />
            </div>
            <CardContent className="relative pb-6">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 items-end gap-4">
                  <div className="relative -mt-12 shrink-0">
                    <Avatar className="h-24 w-24 ring-4 ring-card">
                      {avatar ? <AvatarImage src={avatar} alt="" /> : null}
                      <AvatarFallback className="bg-foreground text-2xl font-semibold text-background">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <span
                      className={`absolute right-1 bottom-1 h-4 w-4 rounded-full ring-2 ring-card ${
                        form.stellarAddress ? 'bg-emerald-500' : 'bg-muted-foreground/50'
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0 pb-1">
                    <h2 className="truncate text-2xl font-bold tracking-tight">{displayName}</h2>
                    <a
                      href={`https://github.com/${githubName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`@${githubName} on GitHub`}
                      className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition hover:text-primary"
                    >
                      <SiGithub className="h-3.5 w-3.5" aria-hidden="true" />@{githubName}
                    </a>
                  </div>
                </div>
                <Badge
                  variant={form.stellarAddress ? 'default' : 'outline'}
                  className={
                    form.stellarAddress
                      ? 'h-auto bg-emerald-500/15 px-3 py-1 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300'
                      : 'h-auto px-3 py-1'
                  }
                >
                  {form.stellarAddress ? 'Ready for payouts' : 'Wallet needed'}
                </Badge>
              </div>

              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                {form.bio.trim() ||
                  'Tell maintainers what you ship, the stacks you like, and how you work.'}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => document.getElementById('location')?.focus()}
                  className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-left transition hover:bg-muted"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background ring-1 ring-border">
                    <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Location
                    </span>
                    <span className="block truncate text-sm font-semibold">
                      {form.location.trim() || 'Add location'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('skills')?.focus()}
                  className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-left transition hover:bg-muted"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background ring-1 ring-border">
                    <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Skills
                    </span>
                    <span className="block truncate text-sm font-semibold">
                      {skills.length ? `${skills.length} listed` : 'Add skills'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    document.getElementById('payout-wallet')?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-left transition hover:bg-muted"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background ring-1 ring-border">
                    <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Wallet
                    </span>
                    <span className="block truncate text-sm font-semibold">
                      {form.stellarAddress ? 'Connected' : 'Not connected'}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => document.getElementById('email')?.focus()}
                  className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3 text-left transition hover:bg-muted"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-background ring-1 ring-border">
                    <Mail className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.68rem] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                      Email
                    </span>
                    <span className="block truncate text-sm font-semibold">
                      {githubEmail ? 'Verified' : 'Not on GitHub'}
                    </span>
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>

          <Card id="payout-wallet" className="scroll-mt-28 rounded-3xl">
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                  Stellar chain
                </p>
                <CardTitle className="mt-1 text-lg">Payout wallet</CardTitle>
                <CardDescription className="mt-1">
                  Connect a Stellar wallet so merged bounties can release USDC to you.
                </CardDescription>
              </div>
              <Image
                src="/stellar-xlm-logo.svg"
                alt=""
                width={36}
                height={36}
                className="h-9 w-9"
              />
            </CardHeader>
            <CardContent>
              {form.stellarAddress ? (
                <div className="rounded-2xl bg-emerald-50 px-4 py-4 dark:bg-emerald-500/10">
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15">
                    Connected
                  </Badge>
                  <p className="mt-2 font-mono text-sm font-semibold break-all text-foreground">
                    {shortenAddress(form.stellarAddress)}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleCopy('wallet', form.stellarAddress, 'Address copied')}
                      variant="outline"
                    >
                      {copiedField === 'wallet' ? (
                        <>
                          <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                          Copy address
                        </>
                      )}
                    </Button>
                    <Button onClick={handleConnectWallet} disabled={connecting} variant="outline">
                      {connecting ? (
                        <>
                          <LoadingLogo size="tiny" variant="circle" />
                          Connecting
                        </>
                      ) : (
                        <>
                          <Wallet className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                          Change wallet
                        </>
                      )}
                    </Button>
                    <Button variant="ghost" onClick={handleDisconnectWallet} disabled={saving}>
                      <Unplug className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-6">
                  <p className="text-sm text-muted-foreground">
                    No wallet connected yet. USDC payouts stay locked until a Stellar address is on
                    this profile.
                  </p>
                  <div className="mt-4">
                    <Button onClick={handleConnectWallet} disabled={connecting}>
                      {connecting ? (
                        <>
                          <LoadingLogo size="tiny" variant="circle" />
                          Connecting
                        </>
                      ) : (
                        <>
                          <Wallet className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                          Connect Stellar wallet
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-full rounded-3xl">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Contributor details</CardTitle>
            <CardDescription>
              This is what maintainers see when they assign a bounty.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="first-name">First name</Label>
              <Input
                id="first-name"
                value={form.firstName}
                onChange={(event) => update('firstName', event.target.value)}
                autoComplete="given-name"
                placeholder="Ada"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last-name">Last name</Label>
              <Input
                id="last-name"
                value={form.lastName}
                onChange={(event) => update('lastName', event.target.value)}
                autoComplete="family-name"
                placeholder="Lovelace"
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="github">GitHub</Label>
              <div className="relative">
                <Input
                  id="github"
                  value={`@${githubName}`}
                  readOnly
                  className="h-10 bg-muted pr-10"
                />
                <a
                  href={`https://github.com/${githubName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open @${githubName} on GitHub`}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition hover:text-primary"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="email">Email</Label>
                {githubEmail ? (
                  <Badge
                    variant="secondary"
                    className="h-5 bg-emerald-100 px-2 text-[0.65rem] font-semibold tracking-wide text-emerald-700 uppercase hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
                  >
                    Verified
                  </Badge>
                ) : null}
              </div>
              <div className="relative">
                <Input id="email" value={githubEmail} readOnly className="h-10 bg-muted pr-10" />
                {githubEmail ? (
                  <button
                    type="button"
                    onClick={() => handleCopy('email', githubEmail, 'Email copied')}
                    aria-label={copiedField === 'email' ? 'Email copied' : 'Copy email'}
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition hover:text-primary"
                  >
                    {copiedField === 'email' ? (
                      <Check className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {githubEmail
                  ? 'Verified through GitHub sign-in.'
                  : 'Sign in with GitHub to attach a verified email.'}
              </p>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="website">Website / portfolio</Label>
              <div className="relative">
                <Input
                  id="website"
                  type="url"
                  value={form.website}
                  onChange={(event) => update('website', event.target.value)}
                  placeholder="https://"
                  className="h-10 pr-10"
                />
                {portfolio ? (
                  <a
                    href={portfolio}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open website"
                    className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground transition hover:text-primary"
                  >
                    <Globe className="h-4 w-4" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telegram">Telegram</Label>
              <div className="relative">
                <SiTelegram
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="pointer-events-none absolute top-1/2 left-9 -translate-y-1/2 text-sm text-muted-foreground">
                  @
                </span>
                <Input
                  id="telegram"
                  value={form.telegram}
                  onChange={(event) => updateUsername('telegram', event.target.value)}
                  placeholder="username"
                  autoComplete="off"
                  className="h-10 pl-14"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="discord">Discord</Label>
              <div className="relative">
                <SiDiscord
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="discord"
                  value={form.discord}
                  onChange={(event) => updateUsername('discord', event.target.value)}
                  placeholder="username"
                  autoComplete="off"
                  className="h-10 pl-10"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="twitter">Twitter / X</Label>
              <div className="relative">
                <SiX
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="pointer-events-none absolute top-1/2 left-9 -translate-y-1/2 text-sm text-muted-foreground">
                  @
                </span>
                <Input
                  id="twitter"
                  value={form.twitter}
                  onChange={(event) => updateUsername('twitter', event.target.value)}
                  placeholder="username"
                  autoComplete="off"
                  className="h-10 pl-14"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin
                  className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="location"
                  value={form.location}
                  onChange={(event) => update('location', event.target.value)}
                  placeholder="City, country, or timezone"
                  autoComplete="address-level2"
                  className="h-10 pl-10"
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="skills">Skills</Label>
              <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-lg border border-input px-2.5 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
                {skills.map((skill) => (
                  <Badge
                    key={skill}
                    variant="secondary"
                    className="h-7 gap-1 rounded-md px-2.5 font-medium"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => removeSkill(skill)}
                      className="rounded-full text-muted-foreground transition hover:text-foreground"
                      aria-label={`Remove ${skill}`}
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </Badge>
                ))}
                <input
                  id="skills"
                  value={skillDraft}
                  onChange={(event) => setSkillDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      addSkill();
                    }
                    if (event.key === 'Backspace' && !skillDraft && skills.length) {
                      removeSkill(skills[skills.length - 1]);
                    }
                  }}
                  placeholder={skills.length ? 'Add another' : 'TypeScript, Rust, Solidity'}
                  className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="bio">Bio</Label>
                <span className="text-xs text-muted-foreground">{form.bio.length} characters</span>
              </div>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(event) => update('bio', event.target.value)}
                rows={6}
                placeholder="What you ship, the stacks you like, and how you work."
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end gap-2 rounded-b-3xl">
            {dirty ? (
              <Button
                variant="danger"
                onClick={() => {
                  setForm(saved);
                  setSkillDraft('');
                }}
                disabled={saving}
              >
                Discard
              </Button>
            ) : null}
            <Button
              onClick={handleSave}
              disabled={!dirty || saving}
              className={!dirty ? 'opacity-50' : undefined}
            >
              {saving ? (
                <>
                  <LoadingLogo size="tiny" variant="circle" />
                  Saving
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                  Save profile
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
