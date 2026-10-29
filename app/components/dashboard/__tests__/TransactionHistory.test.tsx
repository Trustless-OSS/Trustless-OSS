import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// TransactionHistory self-fetches via useActivity when no rows prop is given.
vi.mock('../useActivity', () => ({
  useActivity: () => ({ data: ACTIVITY_FIXTURE, loading: false, error: null }),
}));

import TransactionHistory, { paginateItems } from '../TransactionHistory';
import { ACTIVITY_FIXTURE } from './fixtures';

afterEach(cleanup);

describe('paginateItems', () => {
  it('slices rows into pages and clamps the current page', () => {
    expect(paginateItems(['a', 'b', 'c', 'd'], 1, 2)).toEqual({
      page: 1,
      totalPages: 2,
      items: ['a', 'b'],
    });
    expect(paginateItems(['a', 'b', 'c', 'd'], 9, 2).page).toBe(2);
  });
});

describe('TransactionHistory', () => {
  it('renders transaction details with GitHub and Stellar links', () => {
    render(<TransactionHistory />);

    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getAllByText('#9 Add replay-safe release path').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /c4f9…72a6/i })[0]).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/testnet/tx/c4f91e2a8b7d03e156aa90c2f11b84d7e9c3a0b5d62f18e47a1c9b0d3e5f72a6'
    );
    expect(screen.getAllByRole('link', { name: '@octocat on GitHub' })[0]).toHaveAttribute(
      'href',
      'https://github.com/octocat'
    );
  });

  it('shows pool deposits only under the locked filter', () => {
    render(<TransactionHistory />);

    fireEvent.click(screen.getByRole('tab', { name: 'Locked' }));
    expect(screen.getAllByText('Pool deposit').length).toBeGreaterThan(0);
    expect(screen.queryByText('#161 Reject stale bounty claim')).not.toBeInTheDocument();
  });

  it('uses short event labels', () => {
    render(<TransactionHistory rows={ACTIVITY_FIXTURE} />);

    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Released').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Assigned').length).toBeGreaterThan(0);
    expect(screen.queryByText('Issue rewarded')).not.toBeInTheDocument();
  });

  it('can filter to rejected and unassigned logs', () => {
    render(<TransactionHistory />);

    fireEvent.click(screen.getByRole('tab', { name: 'Rejected' }));
    expect(screen.getAllByText('#161 Reject stale bounty claim').length).toBeGreaterThan(0);
    expect(screen.queryByText('Pool deposit')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Unassigned' }));
    expect(screen.getAllByText('#91 Drop inactive assignee').length).toBeGreaterThan(0);
    expect(screen.queryByText('#161 Reject stale bounty claim')).not.toBeInTheDocument();
  });
});
