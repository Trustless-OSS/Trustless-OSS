import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DashboardMetrics from '../DashboardMetrics';

afterEach(cleanup);

describe('DashboardMetrics', () => {
  it('shows locked and released funds with progress, plus Explore Bounties', () => {
    render(<DashboardMetrics />);

    expect(screen.getByText('Live metrics unavailable — showing sample data.')).toBeInTheDocument();
    expect(screen.getByText('Funds locked')).toBeInTheDocument();
    expect(screen.getByText('3,275 USDC')).toBeInTheDocument();
    expect(screen.getByLabelText('Funds locked share')).toBeInTheDocument();
    expect(screen.getByText('Funds released')).toBeInTheDocument();
    expect(screen.getByText('575 USDC')).toBeInTheDocument();
    expect(screen.getByLabelText('Funds released share')).toBeInTheDocument();
    expect(screen.getByText('Issues rewarded')).toBeInTheDocument();
    expect(screen.getByText('Contributors')).toBeInTheDocument();
    expect(screen.getAllByText('4')).toHaveLength(2);
    expect(screen.getByRole('link', { name: '@gaearon on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/gaearon'
    );
    expect(screen.getByRole('link', { name: '@octocat on GitHub' })).toHaveAttribute(
      'href',
      'https://github.com/octocat'
    );
    expect(screen.queryByRole('link', { name: /contributors/i })).not.toBeInTheDocument();
    expect(screen.queryByText('View leaderboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Value Locked')).not.toBeInTheDocument();
    expect(screen.queryByText('Active Smart Pools')).not.toBeInTheDocument();
  });
});
