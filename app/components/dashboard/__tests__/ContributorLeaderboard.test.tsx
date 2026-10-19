import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchPublicLeaderboard = vi.fn();
vi.mock('@/lib/dashboard-api', () => ({
  fetchPublicLeaderboard: (page: number, pageSize: number) =>
    fetchPublicLeaderboard(page, pageSize),
}));

import ContributorLeaderboard from '../ContributorLeaderboard';
import { githubAvatarUrl } from '../activity';

afterEach(() => {
  cleanup();
  fetchPublicLeaderboard.mockReset();
});

const entry = (over: Partial<Record<string, unknown>>) => ({
  rank: 1,
  name: 'gaearon',
  avatarUrl: githubAvatarUrl('gaearon'),
  earnedUsdc: 220,
  mergedPrs: 1,
  assigned: 1,
  repos: ['trustless-oss/contracts'],
  ...over,
});

describe('ContributorLeaderboard', () => {
  it('fetches the public leaderboard in preview mode', async () => {
    fetchPublicLeaderboard.mockResolvedValueOnce({
      items: [entry({ rank: 1 }), entry({ rank: 2, name: 'octocat' })],
      page: 1,
      pageSize: 5,
      total: 2,
      totalPages: 1,
    });

    render(<ContributorLeaderboard limit={4} expandHref="/leaderboard/1" />);

    await waitFor(() =>
      expect(screen.getAllByRole('link', { name: /on GitHub/ }).length).toBeGreaterThan(0)
    );
    const repoLinks = screen.getAllByRole('link', { name: /trustless-oss/ });
    expect(repoLinks.length).toBeGreaterThan(0);
  });

  it('renders provided entries without fetching', () => {
    render(<ContributorLeaderboard entries={[entry({ rank: 1 })]} />);

    expect(fetchPublicLeaderboard).not.toHaveBeenCalled();
    expect(screen.getAllByRole('link', { name: /trustless-oss/ }).length).toBeGreaterThan(0);
  });
});
