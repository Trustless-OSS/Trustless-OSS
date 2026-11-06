import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import DeployEscrowButton from '../DeployEscrowButton';

const authModal = vi.fn(() => new Promise<never>(() => undefined));

vi.mock('@/lib/wallet-kit', () => ({
  getWalletKit: vi.fn(async () => ({ authModal })),
  getActiveWalletAddress: vi.fn(() => new Promise<never>(() => undefined)),
  withTimeout: async (promise: Promise<unknown>) => promise,
  WALLET_OPERATION_TIMEOUT_MS: 120000,
}));

afterEach(() => {
  cleanup();
  authModal.mockClear();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('DeployEscrowButton', () => {
  it('opens Albedo immediately while initialization is still waiting for the wallet', () => {
    localStorage.setItem('@StellarWalletsKit/selectedModuleId', 'albedo');
    localStorage.setItem('@StellarWalletsKit/activeAddress', 'wallet-address');
    const popup = { closed: false, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    render(<DeployEscrowButton repoId="repo_123" token="session_token" />);
    fireEvent.click(screen.getByRole('button', { name: 'DEPLOY ESCROW CONTRACT' }));
    expect(open).toHaveBeenCalledOnce();
  });

  it('shows a rotating settings icon while quick initialization waits for wallet authorization', async () => {
    render(
      <DeployEscrowButton
        repoId="repo_123"
        token="session_token"
        label="QUICK INITIALIZE"
        loadingLabel="INITIALIZING..."
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'QUICK INITIALIZE' }));

    expect(await screen.findByText('INITIALIZING...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'INITIALIZING...' })).toBeDisabled();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'INITIALIZING...' })).toBeDisabled();
  });
});
