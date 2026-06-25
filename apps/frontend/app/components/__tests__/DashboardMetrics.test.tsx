import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DashboardMetrics from '../DashboardMetrics';

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

describe('DashboardMetrics', () => {
  const mockMetrics = {
    tvl: 27400,
    tvlChange: 12.4,
    activePools: 4,
    totalPools: 7,
    contributorsCount: 5,
    chartData: [],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  it('renders loading state initially', async () => {
    // Make fetch hang
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => {}));

    render(<DashboardMetrics initialToken="test-token" />);

    expect(screen.getByTestId('metrics-loading')).toBeInTheDocument();
  });

  it('renders success state with correct metric calculations', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockMetrics,
    } as Response);

    render(<DashboardMetrics initialToken="test-token" />);

    // Wait for the container to render
    await waitFor(() => {
      expect(screen.getByTestId('metrics-container')).toBeInTheDocument();
    });

    // Check TVL card
    expect(screen.getByTestId('card-tvl')).toBeInTheDocument();
    expect(screen.getByText('$27,400')).toBeInTheDocument();
    expect(screen.getByText('+12.4%')).toBeInTheDocument();

    // Check Active Pools card
    expect(screen.getByTestId('card-pools')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('/ 7')).toBeInTheDocument();
    expect(screen.getByText('57% active pools configured')).toBeInTheDocument();

    // Check progress bar width
    const progressBar = screen.getByTestId('pool-progress-bar');
    expect(progressBar).toHaveStyle({ width: '57%' });

    // Check Dev Contributors card
    expect(screen.getByTestId('card-contributors')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Whitelisted OAuth Verified')).toBeInTheDocument();
  });

  it('renders negative TVL change correctly', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ...mockMetrics,
        tvlChange: -3.5,
      }),
    } as Response);

    render(<DashboardMetrics initialToken="test-token" />);

    await waitFor(() => {
      expect(screen.getByText('-3.5%')).toBeInTheDocument();
    });

    const badge = screen.getByTestId('tvl-change-badge');
    expect(badge).toHaveClass('bg-red-200');
  });

  it('renders error state and supports retry', async () => {
    // Fail first, succeed second
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Database timeout' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics,
      } as Response);

    render(<DashboardMetrics initialToken="test-token" />);

    // Wait for error state
    await waitFor(() => {
      expect(screen.getByTestId('metrics-error')).toBeInTheDocument();
    });
    expect(screen.getByText('Database timeout')).toBeInTheDocument();

    // Click retry
    const retryBtn = screen.getByTestId('metrics-retry-btn');
    fireEvent.click(retryBtn);

    // Wait for container to load after retry
    await waitFor(() => {
      expect(screen.getByTestId('metrics-container')).toBeInTheDocument();
    });
    expect(screen.getByText('$27,400')).toBeInTheDocument();
  });
});
