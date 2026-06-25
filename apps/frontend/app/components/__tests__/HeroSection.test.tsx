import { renderToStaticMarkup } from 'react-dom/server';
import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import HeroSection from '../HeroSection';

function renderHero(user: User | null = null) {
  const markup = renderToStaticMarkup(<HeroSection user={user} />);
  const text = markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { markup, text };
}

describe('HeroSection', () => {
  it('renders the unauthenticated hero with protocol copy and login CTA', () => {
    const { markup, text } = renderHero();

    expect(text).toContain('SYS_STATUS // OPERATIONAL');
    expect(text).toContain('AUTOMATED BOUNTIES FOR OSS.');
    expect(text).toContain('Trustless Escrow');
    expect(text).toContain('Initializing protocol interface');
    expect(text).toContain('INIT_PROTOCOL');
    expect(markup).toContain('href="/login"');
    expect(text).toContain('READ_DOCS');
    expect(markup).toContain('href="/docs"');
  });

  it('renders the authenticated dashboard CTA', () => {
    const { markup, text } = renderHero({ id: 'user_123' } as User);

    expect(text).toContain('ACCESS_DASHBOARD');
    expect(text).not.toContain('INIT_PROTOCOL');
    expect(markup).toContain('href="/dashboard"');
  });
});
