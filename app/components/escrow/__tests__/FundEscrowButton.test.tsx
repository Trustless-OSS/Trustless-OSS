import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FundEscrowButton from '../FundEscrowButton';
import * as walletKit from '@/lib/wallet-kit';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh,
  }),
}));

vi.mock('@/lib/wallet-kit', () => ({
  getWalletKit: vi.fn(),
  getActiveWalletAddress: vi.fn(),
  withTimeout: async (promise: Promise<unknown>) => promise,
  WALLET_OPERATION_TIMEOUT_MS: 120000,
}));

vi.mock('next/image', () => ({
  default: ({ alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img alt={alt ?? ''} {...props} />
  ),
}));

describe('FundEscrowButton', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('keeps the initial amount state neutral until the user submits', () => {
    render(
      <FundEscrowButton
        repoId="repo-1"
        token="token"
        repoName="trustless-oss/web"
        currentBalance={120}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fund' }));

    expect(screen.queryByText(/Enter an amount greater than 0/i)).not.toBeInTheDocument();

    const amountInput = screen.getByLabelText(/^amount$/i);
    fireEvent.change(amountInput, { target: { value: '0' } });

    expect(screen.queryByText(/Enter an amount greater than 0/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(screen.getByText(/Enter an amount greater than 0/i)).toBeInTheDocument();
  });

  it('closes the fund dialog while the wallet modal is open so it stays clickable', async () => {
    vi.mocked(walletKit.getActiveWalletAddress).mockImplementation(
      () => new Promise(() => undefined)
    );
    vi.mocked(walletKit.getWalletKit).mockResolvedValue({
      authModal: vi.fn(() => new Promise(() => undefined)),
      signTransaction: vi.fn(),
    } as never);

    render(
      <FundEscrowButton
        repoId="repo-1"
        token="token"
        repoName="trustless-oss/web"
        currentBalance={120}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fund' }));

    const amountInput = screen.getByLabelText(/^amount$/i);
    fireEvent.change(amountInput, { target: { value: '25' } });

    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Processing/i })).toBeDisabled();
  });

  it('offers quick amount chips', () => {
    render(
      <FundEscrowButton
        repoId="repo-1"
        token="token"
        repoName="trustless-oss/web"
        currentBalance={120}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fund' }));

    expect(screen.getByRole('button', { name: '+25' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+50' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+100' })).toBeInTheDocument();
  });

  it('opens Albedo in the click before wallet loading or transaction preparation', () => {
    localStorage.setItem('@StellarWalletsKit/selectedModuleId', 'albedo');
    localStorage.setItem('@StellarWalletsKit/activeAddress', 'wallet-address');
    const popup = { closed: false, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    vi.mocked(walletKit.getWalletKit).mockReturnValue(new Promise(() => undefined));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(<FundEscrowButton repoId="repo-1" token="token" />);
    fireEvent.click(screen.getByRole('button', { name: 'Fund' }));
    fireEvent.change(screen.getByLabelText(/^amount$/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(open).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the dialog closed until signing finishes and uses the funding account', async () => {
    const signTransaction = vi.fn(() => new Promise(() => undefined));
    vi.mocked(walletKit.getActiveWalletAddress).mockResolvedValue('wallet-address');
    vi.mocked(walletKit.getWalletKit).mockResolvedValue({ signTransaction } as never);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unsignedTransaction: 'unsigned-xdr' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<FundEscrowButton repoId="repo-1" token="token" currentBalance={120} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fund' }));
    fireEvent.change(screen.getByLabelText(/^amount$/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    await waitFor(() =>
      expect(signTransaction).toHaveBeenCalledWith('unsigned-xdr', {
        address: 'wallet-address',
      })
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('hides the primary action after a failed transaction', async () => {
    vi.mocked(walletKit.getWalletKit).mockRejectedValue(new Error('wallet failed'));

    render(
      <FundEscrowButton
        repoId="repo-1"
        token="token"
        repoName="trustless-oss/web"
        currentBalance={120}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fund' }));

    fireEvent.change(screen.getByLabelText(/^amount$/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(await screen.findByText(/Deposit failed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Close$/i })).toBeEnabled();
  });

  it('auto-closes the dialog after successful funding', async () => {
    vi.mocked(walletKit.getActiveWalletAddress).mockResolvedValue('wallet-address');
    vi.mocked(walletKit.getWalletKit).mockResolvedValue({
      authModal: vi.fn().mockResolvedValue({ address: 'wallet-address' }),
      signTransaction: vi.fn().mockResolvedValue({ signedTxXdr: 'signed-xdr' }),
    } as never);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ unsignedTransaction: 'unsigned-xdr' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ transactionHash: 'hash-123' }),
      } as Response);

    vi.stubGlobal('fetch', fetchMock);

    render(
      <FundEscrowButton
        repoId="repo-1"
        token="token"
        repoName="trustless-oss/web"
        currentBalance={120}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fund' }));
    fireEvent.change(screen.getByLabelText(/^amount$/i), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/i }));

    expect(await screen.findByText(/Deposit confirmed/i)).toBeInTheDocument();

    // Wait for auto-close (1.5 seconds)
    await waitFor(
      () => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(refresh).toHaveBeenCalled();
  });
});
