import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FundsMovementChart from '../FundsMovementChart';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'mock-token',
          },
        },
      }),
    },
  }),
}));

// Mock ResponsiveContainer of Recharts to bypass JSDOM width/height issue
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: '800px', height: '400px' }}>{children}</div>
    ),
  };
});

describe('FundsMovementChart', () => {
  const mockChartData = [
    { month: 'Jul', tvl: 5000, payouts: 1000 },
    { month: 'Aug', tvl: 7500, payouts: 1500 },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('renders loading state initially', async () => {
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

    render(<FundsMovementChart initialToken="test-token" />);

    expect(screen.getByTestId('chart-loading')).toBeInTheDocument();
  });

  it('renders success state with chart components', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ chartData: mockChartData }),
    } as Response);

    render(<FundsMovementChart initialToken="test-token" />);

    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });

    expect(screen.getByText('FUNDS_MOVEMENT_LEDGER_')).toBeInTheDocument();
    expect(screen.getByText('TVL')).toBeInTheDocument();
    expect(screen.getByText('PAYOUTS')).toBeInTheDocument();
  });

  it('renders error state and supports retry', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Connection failed' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ chartData: mockChartData }),
      } as Response);

    render(<FundsMovementChart initialToken="test-token" />);

    await waitFor(() => {
      expect(screen.getByTestId('chart-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Connection failed')).toBeInTheDocument();

    const retryBtn = screen.getByTestId('chart-retry-btn');
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });
  });

  it('renders empty state when there is no data', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ chartData: [] }),
    } as Response);

    render(<FundsMovementChart initialToken="test-token" />);

    await waitFor(() => {
      expect(screen.getByTestId('chart-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('NO_ANALYTICS_RECORD')).toBeInTheDocument();
  });
});
