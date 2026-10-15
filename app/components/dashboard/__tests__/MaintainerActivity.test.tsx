import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

vi.mock('recharts', () => {
  return {
    ResponsiveContainer: (props: { children?: React.ReactNode }) =>
      React.createElement('div', null, props.children),
    BarChart: (props: { children?: React.ReactNode }) =>
      React.createElement('div', { 'data-testid': 'bar-chart' }, props.children),
    Bar: () => React.createElement('div', { 'data-testid': 'bar' }),
    XAxis: () => React.createElement('div', { 'data-testid': 'xaxis' }),
    YAxis: () => React.createElement('div', { 'data-testid': 'yaxis' }),
    Tooltip: () => React.createElement('div', { 'data-testid': 'tooltip' }),
    CartesianGrid: () => React.createElement('div', { 'data-testid': 'grid' }),
  };
});

import MaintainerActivity, {
  DEMO_ACTIVITY,
  buildLeaderboard,
  filterActivity,
  listContributors,
  rollupByRepo,
  toRepoChartPoints,
} from '../MaintainerActivity';

afterEach(cleanup);

describe('filterActivity', () => {
  it('keeps every row for all and only matching kinds otherwise', () => {
    expect(filterActivity(DEMO_ACTIVITY, 'all')).toHaveLength(DEMO_ACTIVITY.length);
    expect(filterActivity(DEMO_ACTIVITY, 'rewarded').every((row) => row.kind === 'rewarded')).toBe(
      true
    );
    expect(filterActivity(DEMO_ACTIVITY, 'locked').some((row) => row.kind === 'rewarded')).toBe(
      false
    );
    expect(filterActivity(DEMO_ACTIVITY, 'rejected').every((row) => row.kind === 'rejected')).toBe(
      true
    );
    expect(
      filterActivity(DEMO_ACTIVITY, 'unassigned').every((row) => row.kind === 'unassigned')
    ).toBe(true);
  });
});

describe('listContributors', () => {
  it('returns unique contributors ranked by earnings', () => {
    expect(listContributors(DEMO_ACTIVITY).map((row) => row.name)).toEqual([
      'gaearon',
      'ryzen-xp',
      'octocat',
      'stellar-dev',
    ]);
  });
});

describe('buildLeaderboard', () => {
  it('ranks contributors by earned USDC and counts merged PRs', () => {
    expect(buildLeaderboard(DEMO_ACTIVITY).slice(0, 2)).toEqual([
      expect.objectContaining({
        rank: 1,
        name: 'gaearon',
        earnedUsdc: 220,
        mergedPrs: 1,
        assigned: 1,
      }),
      expect.objectContaining({
        rank: 2,
        name: 'ryzen-xp',
        earnedUsdc: 150,
        mergedPrs: 1,
        assigned: 1,
      }),
    ]);
    expect(buildLeaderboard(DEMO_ACTIVITY)[2]).toEqual(
      expect.objectContaining({
        rank: 3,
        name: 'octocat',
        earnedUsdc: 130,
        mergedPrs: 2,
      })
    );
  });
});

describe('rollupByRepo', () => {
  it('sums rewarded issues and fund movement per repository', () => {
    const web = rollupByRepo(DEMO_ACTIVITY).find((row) => row.repo === 'trustless-oss/web');

    expect(web).toEqual(
      expect.objectContaining({
        repo: 'trustless-oss/web',
        rewarded: 2,
        locked: 1200,
        released: 280,
      })
    );
  });
});

describe('toRepoChartPoints', () => {
  it('maps each maintainer repo to locked, released, and remaining funds', () => {
    expect(toRepoChartPoints(DEMO_ACTIVITY)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'contracts',
          repo: 'trustless-oss/contracts',
          locked: 2000,
          released: 220,
          remaining: 1780,
          rewarded: 1,
        }),
        expect.objectContaining({
          name: 'web',
          repo: 'trustless-oss/web',
          locked: 1200,
          released: 280,
          remaining: 920,
          rewarded: 2,
        }),
        expect.objectContaining({
          name: 'sdk',
          repo: 'trustless-oss/sdk',
          locked: 75,
          released: 75,
          remaining: 0,
          rewarded: 1,
        }),
      ])
    );
  });
});

describe('MaintainerActivity', () => {
  it('renders funds and rewarded charts without an activity feed', () => {
    render(<MaintainerActivity />);

    expect(screen.getByText('Repository funds')).toBeInTheDocument();
    expect(screen.getByText('Explore Bounties')).toBeInTheDocument();
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(2);
    expect(screen.queryByTestId('line')).not.toBeInTheDocument();
    expect(screen.queryByText('Activity')).not.toBeInTheDocument();
  });
});
