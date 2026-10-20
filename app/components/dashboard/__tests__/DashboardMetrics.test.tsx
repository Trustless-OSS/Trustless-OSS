import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../useActivity', () => ({
  useActivity: () => ({ data: ACTIVITY_FIXTURE, loading: false, error: null }),
}));
const fetchDeployedEscrowBalance = vi.hoisted(() => vi.fn());
vi.mock('@/lib/dashboard-api', () => ({
  fetchDeployedEscrowBalance,
}));

import DashboardMetrics from '../DashboardMetrics';
import { ACTIVITY_FIXTURE } from './fixtures';

afterEach(() => {
  cleanup();
  fetchDeployedEscrowBalance.mockReset();
});

describe('DashboardMetrics', () => {
  it('shows deployed escrow balance with the currently locked portion highlighted', async () => {
    fetchDeployedEscrowBalance.mockResolvedValue(1000);
    render(<DashboardMetrics />);

    expect(await screen.findByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('1,000 USDC')).toBeInTheDocument();
    expect(screen.getByText('Total held: 1,000 USDC')).toBeInTheDocument();
    expect(screen.getByText('Currently locked: 400 USDC')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: 'Escrow balance: 1,000 USDC held, including 400 USDC currently locked',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('Funds released')).toBeInTheDocument();
    expect(screen.getByText('220 USDC')).toBeInTheDocument();
    expect(screen.getByLabelText('Funds released share')).toBeInTheDocument();
    expect(screen.getByText('Issues rewarded')).toBeInTheDocument();
    expect(screen.getByText('Contributors')).toBeInTheDocument();
    expect(screen.queryByText('Total Value Locked')).not.toBeInTheDocument();
  });

  it('shows an error if deployed escrow balances cannot be loaded', async () => {
    fetchDeployedEscrowBalance.mockRejectedValue(new Error('Repository balance unavailable'));
    render(<DashboardMetrics />);

    expect(await screen.findByText('Repository balance unavailable')).toBeInTheDocument();
  });
});
