import { afterEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: createClientMock,
}));

import { fetchDeployedEscrowBalance } from '../dashboard-api';

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
