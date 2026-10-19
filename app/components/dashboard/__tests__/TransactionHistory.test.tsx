import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import TransactionHistory, { paginateItems } from '../TransactionHistory';
import { DEMO_ACTIVITY } from '../MaintainerActivity';

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
  it('renders sample transaction details with GitHub and Stellar links', () => {
    render(<TransactionHistory />);

    expect(screen.getByText('Activity')).toBeInTheDocument();
    expect(screen.getAllByText('#9 Add replay-safe release path').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /c4f9…72a6/i })[0]).toHaveAttribute(
      'href',
      'https://stellar.expert/explorer/public/tx/c4f91e2a8b7d03e156aa90c2f11b84d7e9c3a0b5d62f18e47a1c9b0d3e5f72a6'
    );
    expect(screen.getAllByRole('link', { name: '@octocat on GitHub' })[0]).toHaveAttribute(
      'href',
      'https://github.com/octocat'
    );
  });

  it('does not show rewarded-only issues in the locked history filter', () => {
    render(<TransactionHistory />);

    fireEvent.click(screen.getByRole('tab', { name: 'Locked' }));

    expect(screen.getAllByText('Pool deposit').length).toBeGreaterThan(0);
    expect(screen.queryByText('#12 Harden milestone release checks')).not.toBeInTheDocument();
  });

  it('pages through older transactions with next, back, and page indexes', () => {
    render(<TransactionHistory />);

    // Verify pagination controls exist
    expect(screen.getByRole('button', { name: 'Page 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 2' })).toBeInTheDocument();

    // Click page 2
    fireEvent.click(screen.getByRole('button', { name: 'Page 2' }));
    const page2Rows = screen.getAllByRole('row');
    expect(page2Rows.length).toBeGreaterThan(0);

    // Click back
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    const page1Rows = screen.getAllByRole('row');
    expect(page1Rows.length).toBeGreaterThan(0);

    // Click next
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const nextRows = screen.getAllByRole('row');
    expect(nextRows.length).toBeGreaterThan(0);
  });

  it('uses short event labels', () => {
    render(<TransactionHistory rows={DEMO_ACTIVITY.slice(0, 4)} />);

    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Released').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Assigned').length).toBeGreaterThan(0);
    expect(screen.queryByText('Issue rewarded')).not.toBeInTheDocument();
    expect(screen.queryByText('Funds released')).not.toBeInTheDocument();
    expect(screen.queryByText('Contributor assigned')).not.toBeInTheDocument();
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
