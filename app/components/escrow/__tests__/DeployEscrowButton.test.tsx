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
});

describe('DeployEscrowButton', () => {
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
