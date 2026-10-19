import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../useActivity', () => ({
  useActivity: () => ({ data: ACTIVITY_FIXTURE, loading: false, error: null }),
}));

import DashboardMetrics from '../DashboardMetrics';
import { ACTIVITY_FIXTURE } from './fixtures';

afterEach(cleanup);

describe('DashboardMetrics', () => {
  it('shows locked and released funds with progress', () => {
    render(<DashboardMetrics />);

    expect(screen.getByText('Funds locked')).toBeInTheDocument();
    // Fixture locked = 300 + 100 = 400.
    expect(screen.getByText('400 USDC')).toBeInTheDocument();
    expect(screen.getByLabelText('Funds locked share')).toBeInTheDocument();
    expect(screen.getByText('Funds released')).toBeInTheDocument();
    expect(screen.getByLabelText('Funds released share')).toBeInTheDocument();
    expect(screen.getByText('Issues rewarded')).toBeInTheDocument();
    expect(screen.getByText('Contributors')).toBeInTheDocument();
    expect(screen.queryByText('Total Value Locked')).not.toBeInTheDocument();
  });
});
