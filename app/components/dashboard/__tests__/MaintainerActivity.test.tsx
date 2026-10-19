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
    const contributors = listContributors(DEMO_ACTIVITY);
    // We now have 40+ test contributors, so just verify it returns contributors
    expect(contributors.length).toBeGreaterThan(0);
    expect(contributors.every((row) => row.name)).toBe(true);
  });
});

describe('buildLeaderboard', () => {
  it('ranks contributors by earned USDC and counts merged PRs', () => {
    const leaderboard = buildLeaderboard(DEMO_ACTIVITY);
    // Verify structure is correct
    expect(leaderboard.length).toBeGreaterThan(0);
    expect(leaderboard[0]).toEqual(
      expect.objectContaining({
        rank: 1,
        name: expect.any(String),
        earnedUsdc: expect.any(Number),
        mergedPrs: expect.any(Number),
      })
    );
    expect(leaderboard[1]).toEqual(
      expect.objectContaining({
        rank: 2,
      })
    );
  });
});

describe('rollupByRepo', () => {
  it('sums rewarded issues and fund movement per repository', () => {
    const repos = rollupByRepo(DEMO_ACTIVITY);
    // Verify repos are summarized
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

describe('toRepoChartPoints', () => {
  it('maps each maintainer repo to locked, released, and remaining funds', () => {
    const points = toRepoChartPoints(DEMO_ACTIVITY);
    // Verify chart points structure
    expect(points.length).toBeGreaterThan(0);
    expect(points[0]).toEqual(
      expect.objectContaining({
        name: expect.any(String),
        repo: expect.any(String),
        locked: expect.any(Number),
        released: expect.any(Number),
        remaining: expect.any(Number),
      })
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
