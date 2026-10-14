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
  it('renders the unauthenticated bounty overview and login CTA without terminal copy', () => {
    const { markup, text } = renderHero();

    expect(text).toContain('GitHub-native contributor payments');
    expect(text).toContain('Fund the work Merge the proof Release the reward');
    expect(text).toContain('USDC Stellar chain');
    expect(text).toContain('Example bounty');
    expect(text).toContain('Merge releases payout');
    expect(markup).toContain('/usd-coin-usdc-logo.svg');
    expect(text).toContain('Connect GitHub');
    expect(markup).toContain('href="/login"');
    expect(text).toContain('Read the guide');
    expect(markup).toContain('href="/docs"');
    expect(text).not.toContain('CMD_PROMPT_INPUT');
    expect(text).not.toContain('Gas Cost');
    expect(text).not.toContain('crypto-guardian');
  });

  it('renders the authenticated dashboard CTA', () => {
    const { markup, text } = renderHero({ id: 'user_123' } as User);

    expect(text).toContain('Dashboard');
    expect(text).not.toContain('Connect GitHub');
    expect(markup).toContain('href="/dashboard"');
  });
});
