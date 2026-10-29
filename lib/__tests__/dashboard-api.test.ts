import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: createClientMock,
}));

import {
  fetchActivity,
  fetchDashboardRepos,
  fetchDeployedEscrowBalance,
  fetchFundsMovement,
} from '../dashboard-api';

function mockAuthenticatedFetch(body: unknown) {
  createClientMock.mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'session-token' } },
      }),
    },
  });
  const fetchMock = vi.fn().mockResolvedValue(Response.json(body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchDeployedEscrowBalance', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('sums the on-chain balances only for deployed repositories', async () => {
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'session-token' } },
        }),
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: [
            { escrow_contract_id: 'contract-1', escrow_balance: '125.5' },
            { escrow_contract_id: 'contract-2', escrow_balance: 250 },
            { escrow_contract_id: null, escrow_balance: 900 },
          ],
        })
      )
    );

    await expect(fetchDeployedEscrowBalance()).resolves.toBe(375.5);
  });

  it('surfaces an invalid repositories response', async () => {
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'session-token' } },
        }),
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ unexpected: [] })));

    await expect(fetchDeployedEscrowBalance()).rejects.toThrow(
      'Unexpected repositories response from the server.'
    );
  });
});

describe('fetchActivity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('maps the documented activity response envelope', async () => {
    mockAuthenticatedFetch({
      data: [
        {
          id: 'act_16',
          at: '2026-09-04T12:10:00.000Z',
          repo: 'trustless-oss/contracts',
          issue_number: 9,
          issue_title: 'Add replay-safe release path',
          kind: 'released',
          amount_usdc: '220',
          contributor: 'gaearon',
          tx_hash: 'abc123',
        },
      ],
    });

    await expect(fetchActivity()).resolves.toEqual([
      {
        id: 'act_16',
        at: '2026-09-04T12:10:00.000Z',
        repo: 'trustless-oss/contracts',
        issueNumber: 9,
        issueTitle: 'Add replay-safe release path',
        kind: 'released',
        amountUsdc: 220,
        contributor: 'gaearon',
        txHash: 'abc123',
      },
    ]);
  });
});

describe('fetchFundsMovement', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('requests 12 months and places the live escrow balance on the current month', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T12:00:00.000Z'));
    const fetchMock = mockAuthenticatedFetch({
      data: [],
    });
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/dashboard/funds-movement')) {
        return Promise.resolve(
          Response.json({
            data: [
              { month: '2026-09', label: 'Sep', tvl: '0', payouts: 0 },
              { month: '2026-10', label: 'Oct', tvl: '0', payouts: '0' },
            ],
          })
        );
      }
      return Promise.resolve(
        Response.json({
          data: [{ escrow_contract_id: 'contract-1', escrow_balance: '1' }],
        })
      );
    });

    const points = await fetchFundsMovement();
    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ month: 'Nov', period: '2025-11', tvl: 0, payouts: 0 });
    expect(points.find((point) => point.period === '2026-09')).toEqual({
      month: 'Sep',
      period: '2026-09',
      tvl: 0,
      payouts: 0,
    });
    expect(points.at(-1)).toEqual({
      month: 'Oct',
      period: '2026-10',
      tvl: 1,
      payouts: 0,
    });
    expect(fetchMock.mock.calls[0][0]).toContain('/dashboard/funds-movement?months=12');
  });

  it('fills a 12-month zero-valued series when there is no fund history', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T12:00:00.000Z'));
    const fetchMock = mockAuthenticatedFetch({ data: [] });
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        Response.json(
          String(input).includes('/dashboard/funds-movement')
            ? { data: [] }
            : { data: [{ escrow_contract_id: 'contract-1', escrow_balance: 0 }] }
        )
      )
    );

    const points = await fetchFundsMovement();
    expect(points).toHaveLength(12);
    expect(points.every((point) => point.tvl === 0 && point.payouts === 0)).toBe(true);
    expect(points.at(-1)?.period).toBe('2026-10');
  });

  it('skips invalid entries and fills missing months with zeros', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T12:00:00.000Z'));
    const fetchMock = mockAuthenticatedFetch({ data: [] });
    fetchMock.mockImplementation((input: RequestInfo | URL) =>
      Promise.resolve(
        Response.json(
          String(input).includes('/dashboard/funds-movement')
            ? { data: [{ month: 'not-a-month', tvl: 10, payouts: 4 }] }
            : { data: [] }
        )
      )
    );

    const points = await fetchFundsMovement();
    // Should still return 12 months, just skipping the invalid entry
    expect(points).toHaveLength(12);
    expect(points.every((point) => point.tvl === 0 && point.payouts === 0)).toBe(true);
  });
});

describe('fetchDashboardRepos', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  it('maps the documented repository chart response', async () => {
    const fetchMock = mockAuthenticatedFetch({
      data: [
        {
          full_name: 'trustless-oss/web',
          name: 'web',
          escrow_contract_id: 'contract-1',
          escrow_balance: '1',
        },
      ],
    });

    await expect(fetchDashboardRepos()).resolves.toEqual([
      {
        name: 'web',
        repo: 'trustless-oss/web',
        locked: 1,
        released: 0,
        remaining: 1,
        rewarded: 0,
      },
    ]);
    expect(fetchMock.mock.calls[0][0]).toContain('/repos');
  });

  it('surfaces invalid repository chart data', async () => {
    mockAuthenticatedFetch({
      data: [{ escrow_contract_id: 'contract-1', full_name: 'trustless-oss/web' }],
    });

    await expect(fetchDashboardRepos()).rejects.toThrow('Invalid repository escrow balance');
  });
});
