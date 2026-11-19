import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RecentBounties from '../RecentBounties';
import { fetchRecentBounties, fetchBountyPage } from '@/lib/dashboard-api';

vi.mock('@/lib/dashboard-api', () => ({ fetchRecentBounties: vi.fn(), fetchBountyPage: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('RecentBounties', () => {
  const rows = Array.from({ length: 15 }, (_, i) => ({
    id: String(i),
    repo: 'org/repo',
    issueNumber: i + 1,
    issueTitle: `Bounty ${i + 1}`,
    amountUsdc: 20,
    at: '2026-11-01T00:00:00Z',
  }));
  it('limits the homepage to five issues and links to explore', async () => {
    vi.mocked(fetchRecentBounties).mockResolvedValue(rows);
    render(<RecentBounties />);
    await screen.findByText('Bounty 1');
    expect(screen.getAllByRole('link', { name: /Bounty \d/ })).toHaveLength(5);
    expect(screen.queryByText('Bounty 6')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore more' })).toHaveAttribute('href', '/explore');
  });
  it('shows the full explore page with working pagination links', async () => {
    vi.mocked(fetchBountyPage).mockResolvedValue({
      items: rows,
      page: 2,
      hasMore: true,
      totalPages: 3,
    });
    render(<RecentBounties page={2} />);
    await screen.findByText('Bounty 15');
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Page 3' })).toHaveAttribute('href', '/explore?page=3');
    expect(fetchBountyPage).toHaveBeenCalledWith(2);
    expect(screen.getByRole('link', { name: /previous page/i })).toHaveAttribute(
      'href',
      '/explore?page=1'
    );
    expect(screen.getByRole('link', { name: /next page/i })).toHaveAttribute(
      'href',
      '/explore?page=3'
    );
  });
  it('keeps navigation available for an empty intermediate page', async () => {
    vi.mocked(fetchBountyPage).mockResolvedValue({
      items: [],
      page: 2,
      hasMore: true,
      totalPages: 3,
    });
    render(<RecentBounties page={2} />);
    await screen.findByText(/No available issues on this page/);
    expect(screen.getByRole('link', { name: /next page/i })).toHaveAttribute(
      'href',
      '/explore?page=3'
    );
  });
  it('shows real issue details and a GitHub link', async () => {
    vi.mocked(fetchRecentBounties).mockResolvedValue([
      {
        id: '1',
        repo: 'org/repo',
        issueNumber: 42,
        issueTitle: 'Improve wallet setup',
        amountUsdc: 25,
        at: '2026-11-01T10:00:00Z',
      },
    ]);
    render(<RecentBounties />);
    expect(await screen.findByRole('link', { name: /Improve wallet setup/ })).toHaveAttribute(
      'href',
      'https://github.com/org/repo/issues/42'
    );
    expect(screen.getByText('25 USDC')).toBeInTheDocument();
    expect(screen.getByText('3:30 PM IST')).toBeInTheDocument();
    expect(screen.queryByText('Testnet reward')).not.toBeInTheDocument();
    expect(screen.queryByText(/Live reward updates/)).not.toBeInTheDocument();
  });
  it('shows an empty state rather than sample events', async () => {
    vi.mocked(fetchRecentBounties).mockResolvedValue([]);
    render(<RecentBounties />);
    expect(await screen.findByText(/No open bounties/)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
  it('lets visitors retry a failed request', async () => {
    vi.mocked(fetchRecentBounties)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([]);
    render(<RecentBounties />);
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No open bounties/)).toBeInTheDocument();
    expect(fetchRecentBounties).toHaveBeenCalledTimes(2);
  });
});
