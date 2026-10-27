import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import React from 'react';

// Mock recharts to avoid requiring the library in test environment.
vi.mock('recharts', () => {
  return {
    ResponsiveContainer: (props: { children?: React.ReactNode }) =>
      React.createElement('div', null, props.children),
    AreaChart: (props: { children?: React.ReactNode; data?: Array<{ period: string }> }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'area-chart',
          'data-point-count': props.data?.length,
          'data-last-period': props.data?.at(-1)?.period,
        },
        props.children
      ),
    Area: () => React.createElement('div', { 'data-testid': 'area' }),
    XAxis: () => React.createElement('div', { 'data-testid': 'xaxis' }),
    YAxis: () => React.createElement('div', { 'data-testid': 'yaxis' }),
    Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
    CartesianGrid: () => React.createElement('div', { 'data-testid': 'grid' }),
    ReferenceDot: (props: { x?: string; yAxisId?: string }) =>
      React.createElement('div', {
        'data-testid': 'reference-dot',
        'data-x': props.x,
        'data-y-axis': props.yAxisId,
      }),
    ReferenceLine: (props: { x?: string }) =>
      React.createElement('div', { 'data-testid': 'reference-line', 'data-x': props.x }),
  };
});

const fetchFundsMovement = vi.fn();
vi.mock('@/lib/dashboard-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dashboard-api')>();
  return {
    ...actual,
    fetchFundsMovement: () => fetchFundsMovement(),
  };
});

import FundsMovementChart from '../FundsMovementChart';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('FundsMovementChart', () => {
  it('renders chart with data from the API', async () => {
    const now = new Date();
    const points = Array.from({ length: 12 }, (_, index) => {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const period = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      return {
        month: new Intl.DateTimeFormat('en-US', { month: 'short' }).format(monthDate),
        period,
        tvl: 1000 + index * 100,
        payouts: 800 + index * 50,
      };
    });
    fetchFundsMovement.mockResolvedValueOnce(points);

    render(<FundsMovementChart />);

    await waitFor(() => expect(screen.getByText('Escrow TVL locked')).toBeInTheDocument());
    expect(screen.getByText('Payouts released')).toBeInTheDocument();
    expect(screen.getAllByTestId('area').length).toBeGreaterThanOrEqual(1);
    const chart = screen.getByTestId('area-chart');
    const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    expect(chart).toHaveAttribute('data-point-count', '12');
    expect(chart).toHaveAttribute('data-last-period', currentPeriod);
    expect(screen.getAllByTestId('reference-dot')).toHaveLength(2);
    expect(screen.getByTestId('reference-line')).toHaveAttribute('data-x', currentPeriod);
  });

  it('renders the zero-valued graph when there is no fund history', async () => {
    fetchFundsMovement.mockResolvedValueOnce([]);

    render(<FundsMovementChart />);

    const chart = await screen.findByTestId('area-chart');
    expect(chart).toHaveAttribute('data-point-count', '12');
    expect(chart).toHaveAttribute('data-last-period', expect.stringMatching(/^\d{4}-\d{2}$/));
    expect(screen.getAllByTestId('area')).toHaveLength(2);
  });

  it('shows an error message when the request fails', async () => {
    fetchFundsMovement.mockRejectedValueOnce(new Error('boom'));

    render(<FundsMovementChart />);

    expect(screen.getByText('Funds movement')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('boom')).toBeInTheDocument());
  });
});
