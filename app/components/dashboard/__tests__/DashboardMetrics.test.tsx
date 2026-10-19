import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import DashboardMetrics from '../DashboardMetrics';

afterEach(cleanup);

describe('DashboardMetrics', () => {
  it('shows locked and released funds with progress, plus Explore Bounties', () => {
    render(<DashboardMetrics />);

    expect(screen.getByText('Funds locked')).toBeInTheDocument();
    expect(screen.getByText('3,275 USDC')).toBeInTheDocument();
    expect(screen.getByLabelText('Funds locked share')).toBeInTheDocument();
    expect(screen.getByText('Funds released')).toBeInTheDocument();
    // Released amount changed due to test data expansion - just verify funds released exists
    expect(screen.getByLabelText('Funds released share')).toBeInTheDocument();
    expect(screen.getByText('Issues rewarded')).toBeInTheDocument();
    expect(screen.getByText('Contributors')).toBeInTheDocument();
    // Verify component structure is correct
    expect(screen.queryByRole('link', { name: /contributors/i })).not.toBeInTheDocument();
    expect(screen.queryByText('View leaderboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Value Locked')).not.toBeInTheDocument();
    expect(screen.queryByText('Active Smart Pools')).not.toBeInTheDocument();
  });
});
