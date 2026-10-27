import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const fetchDashboardReposMock = vi.hoisted(() => vi.fn());

vi.mock('recharts', () => {
  return {
    ResponsiveContainer: (props: { children?: React.ReactNode }) =>
      React.createElement('div', null, props.children),
    BarChart: (props: {
      children?: React.ReactNode;
      data?: Array<{ locked: number; rewarded: number }>;
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'bar-chart',
          'data-point-count': props.data?.length,
          'data-locked': props.data?.[0]?.locked,
          'data-rewarded': props.data?.[0]?.rewarded,
        },
        props.children
      ),
    Bar: () => React.createElement('div', { 'data-testid': 'bar' }),
    XAxis: () => React.createElement('div', { 'data-testid': 'xaxis' }),
    YAxis: () => React.createElement('div', { 'data-testid': 'yaxis' }),
    Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
    CartesianGrid: () => React.createElement('div', { 'data-testid': 'grid' }),
  };
});

vi.mock('@/lib/dashboard-api', () => ({
  fetchDashboardRepos: fetchDashboardReposMock,
}));

import MaintainerActivity from '../MaintainerActivity';
import {
  buildLeaderboard,
  filterActivity,
  listContributors,
  rollupByRepo,
  summarizeCurrentlyLocked,
} from '../activity';
import { ACTIVITY_FIXTURE } from './fixtures';

beforeEach(() => {
  fetchDashboardReposMock.mockResolvedValue([
    {
      name: 'web',
      repo: 'trustless-oss/web',
      locked: 300,
      released: 120,
      remaining: 180,
      rewarded: 2,
    },
  ]);
});

afterEach(() => {
  cleanup();
  fetchDashboardReposMock.mockReset();
});

describe('filterActivity', () => {
  it('keeps every row for all and only matching kinds otherwise', () => {
    expect(filterActivity(ACTIVITY_FIXTURE, 'all')).toHaveLength(ACTIVITY_FIXTURE.length);
    expect(
      filterActivity(ACTIVITY_FIXTURE, 'rewarded').every((row) => row.kind === 'rewarded')
    ).toBe(true);
    expect(filterActivity(ACTIVITY_FIXTURE, 'locked').some((row) => row.kind === 'rewarded')).toBe(
      false
    );
    expect(
      filterActivity(ACTIVITY_FIXTURE, 'rejected').every((row) => row.kind === 'rejected')
    ).toBe(true);
    expect(
      filterActivity(ACTIVITY_FIXTURE, 'unassigned').every((row) => row.kind === 'unassigned')
    ).toBe(true);
  });
});

describe('listContributors', () => {
  it('returns unique contributors ranked by earnings', () => {
    const contributors = listContributors(ACTIVITY_FIXTURE);
    expect(contributors.length).toBeGreaterThan(0);
    expect(contributors.every((row) => row.name)).toBe(true);
  });
});

describe('buildLeaderboard', () => {
  it('ranks contributors by earned USDC and counts merged PRs', () => {
    const leaderboard = buildLeaderboard(ACTIVITY_FIXTURE);
    expect(leaderboard.length).toBeGreaterThan(0);
    expect(leaderboard[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        name: 'gaearon',
        earnedUsdc: 220,
        mergedPrs: 1,
      })
    );
  });
});

describe('rollupByRepo', () => {
  it('sums rewarded issues and fund movement per repository', () => {
    const repos = rollupByRepo(ACTIVITY_FIXTURE);
    expect(repos.length).toBeGreaterThan(0);
    expect(repos[0]).toEqual(
      expect.objectContaining({
        repo: expect.any(String),
        rewarded: expect.any(Number),
        locked: expect.any(Number),
        released: expect.any(Number),
      })
    );
  });
});

describe('summarizeCurrentlyLocked', () => {
  it('subtracts released payouts from locked funds within each repository', () => {
    expect(
      summarizeCurrentlyLocked([
        {
          id: 'lock',
          at: '2026-09-04T10:00:00.000Z',
          repo: 'trustless-oss/web',
          issueNumber: 142,
          issueTitle: 'Bounty',
          kind: 'locked',
          amountUsdc: 300,
          contributor: null,
          txHash: null,
        },
        {
          id: 'release',
          at: '2026-09-04T11:00:00.000Z',
          repo: 'trustless-oss/web',
          issueNumber: 142,
          issueTitle: 'Bounty',
          kind: 'released',
          amountUsdc: 120,
          contributor: 'octocat',
          txHash: null,
        },
      ])
    ).toBe(180);
  });
});

describe('MaintainerActivity', () => {
  it('renders funds and rewarded charts from the repositories API', async () => {
    render(<MaintainerActivity />);

    expect(await screen.findByText('Repository funds')).toBeInTheDocument();
    expect(screen.getByText('Explore Bounties')).toBeInTheDocument();
    expect(await screen.findAllByTestId('bar-chart')).toHaveLength(2);
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();
  });

  it('shows graph skeletons in both cards when there are no repository amounts', async () => {
    fetchDashboardReposMock.mockResolvedValueOnce([]);
    render(<MaintainerActivity />);

    expect(await screen.findByText('Repository funds')).toBeInTheDocument();
    expect(screen.getByText('Explore Bounties')).toBeInTheDocument();
    expect(await screen.findAllByTestId('empty-chart-skeleton')).toHaveLength(2);
    expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
  });

  it('shows the funds chart and a graph skeleton for empty bounties', async () => {
    fetchDashboardReposMock.mockResolvedValueOnce([
      {
        name: 'funded',
        repo: 'trustless-oss/funded',
        locked: 1,
        released: 0,
        remaining: 1,
        rewarded: 0,
      },
    ]);
    render(<MaintainerActivity />);

    expect(await screen.findByTestId('bar-chart')).toBeInTheDocument();
    expect(await screen.findByTestId('empty-chart-skeleton')).toHaveAttribute(
      'aria-label',
      'Explore Bounties chart; waiting for data'
    );
    expect(screen.getByText('Repository funds')).toBeInTheDocument();
    expect(screen.getByText('Explore Bounties')).toBeInTheDocument();
  });

  it('shows both chart cards when both charts have matching values', async () => {
    fetchDashboardReposMock.mockResolvedValueOnce([
      {
        name: 'funded',
        repo: 'trustless-oss/funded',
        locked: 1,
        released: 0,
        remaining: 1,
        rewarded: 2,
      },
    ]);
    render(<MaintainerActivity />);

    expect(await screen.findByText('Repository funds')).toBeInTheDocument();
    expect(screen.getByText('Explore Bounties')).toBeInTheDocument();
    expect(await screen.findAllByTestId('bar-chart')).toHaveLength(2);
  });

  it('shows a repository API error instead of empty chart states', async () => {
    fetchDashboardReposMock.mockRejectedValueOnce(new Error('API unavailable'));
    render(<MaintainerActivity />);

    expect(await screen.findAllByRole('alert')).toHaveLength(2);
    expect(screen.getAllByText('API unavailable')).toHaveLength(2);
  });
});
