import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const PROFILE_ADDRESS = `G${'A'.repeat(55)}`;
const OTHER_ADDRESS = `G${'C'.repeat(55)}`;
const { refresh, notifySuccess } = vi.hoisted(() => ({
  refresh: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));
vi.mock('@/lib/wallet-kit', () => ({
  getWalletKit: async () => ({
    getAddress: async () => {
      throw new Error('No wallet selected');
    },
  }),
}));
vi.mock('@/lib/backend', () => ({
  backendUrl: (path: string) => path,
  authHeaders: () => ({ Authorization: 'Bearer test-token' }),
}));
vi.mock('@/lib/notifications', () => ({
  handleError: vi.fn(),
  notifySuccess,
}));
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={alt ?? ''} {...props} />
  ),
}));

import RefundFundButton from '../RefundFundButton';

function mockRefund(profileAddress = '') {
  const fetchMock = vi.fn().mockImplementation(async (url: string) => ({
    ok: true,
    json: async () =>
      url === '/contributor/me'
        ? { contributor: { stellar_wallet: profileAddress } }
        : { refundedAmount: 25, cancelledIssues: 0 },
  }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function expectDestination(fetchMock: ReturnType<typeof vi.fn>, address: string) {
  expect(fetchMock).toHaveBeenCalledWith('/api/v1/escrow/refund', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token' },
    body: JSON.stringify({ repoId: 'repo-1', maintainerWallet: address }),
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  refresh.mockReset();
  notifySuccess.mockReset();
});

describe('RefundFundButton destinations', () => {
  it('can withdraw to the saved profile wallet', async () => {
    const fetchMock = mockRefund(PROFILE_ADDRESS);
    render(<RefundFundButton repoId="repo-1" token="test-token" currentBalance={25} />);

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    const profile = await screen.findByRole('radio', { name: /Profile wallet/ });
    fireEvent.click(profile);
    expect(profile).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(PROFILE_ADDRESS)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Full Withdraw' }));

    await waitFor(() => expectDestination(fetchMock, PROFILE_ADDRESS));
  });

  it('validates a manually entered destination before withdrawal', async () => {
    const fetchMock = mockRefund();
    render(<RefundFundButton repoId="repo-1" token="test-token" currentBalance={25} />);

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }));
    fireEvent.click(screen.getByRole('radio', { name: /Other Stellar address/ }));
    const submit = screen.getByRole('button', { name: 'Full Withdraw' });
    const input = screen.getByRole('textbox', { name: 'Destination address' });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: 'invalid' } });
    expect(submit).toBeDisabled();
    fireEvent.change(input, { target: { value: OTHER_ADDRESS } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expectDestination(fetchMock, OTHER_ADDRESS));
  });
});
