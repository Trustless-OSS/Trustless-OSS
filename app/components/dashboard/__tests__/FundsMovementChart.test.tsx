import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

// Mock recharts to avoid requiring the library in test environment.
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: (props: { children?: React.ReactNode }) =>
      React.createElement('div', null, props.children),
    AreaChart: (props: { children?: React.ReactNode }) =>
      React.createElement('div', null, props.children),
    Area: () => React.createElement('div', { 'data-testid': 'area' }),
    XAxis: () => React.createElement('div', { 'data-testid': 'xaxis' }),
    YAxis: () => React.createElement('div', { 'data-testid': 'yaxis' }),
    Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
    Legend: () => React.createElement('div', { 'data-testid': 'legend' }),
    CartesianGrid: () => React.createElement('div', { 'data-testid': 'grid' }),
  };
});

const fetchFundsMovement = vi.fn();
vi.mock('@/lib/dashboard-api', () => ({
  fetchFundsMovement: () => fetchFundsMovement(),
}));

import FundsMovementChart from '../FundsMovementChart';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FundsMovementChart', () => {
  it('renders chart with data from the API', async () => {
    fetchFundsMovement.mockResolvedValueOnce([
      { month: 'Jul', period: '2026-07', tvl: 1000, payouts: 800 },
      { month: 'Aug', period: '2026-08', tvl: 1500, payouts: 900 },
      { month: 'Sep', period: '2026-09', tvl: 2000, payouts: 1200 },
    ]);

    render(<FundsMovementChart />);

    await waitFor(() => expect(screen.getByTestId('legend')).toBeInTheDocument());
    expect(screen.getAllByTestId('area').length).toBeGreaterThanOrEqual(1);
  });

  it('shows an error message when the request fails', async () => {
    fetchFundsMovement.mockRejectedValueOnce(new Error('boom'));

    render(<FundsMovementChart />);

    expect(screen.getByText('Funds movement')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });
});
