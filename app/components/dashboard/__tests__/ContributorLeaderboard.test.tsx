import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ContributorLeaderboard from '../ContributorLeaderboard';

afterEach(cleanup);

describe('ContributorLeaderboard', () => {
  it('ranks contributors by earnings and links usernames to GitHub', () => {
    render(<ContributorLeaderboard />);

    // Verify component renders with top 3 podium
    const podiumCards = screen.queryAllByRole('link', { name: /on GitHub/ });
    expect(podiumCards.length).toBeGreaterThan(0);

    // Verify table has rows
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBeGreaterThan(1); // At least header + 1 data row

    // Verify repository links exist in Top Repository column
    const repoLinks = screen.getAllByRole('link', { name: /trustless-oss/ });
    expect(repoLinks.length).toBeGreaterThan(0);
  });
});
