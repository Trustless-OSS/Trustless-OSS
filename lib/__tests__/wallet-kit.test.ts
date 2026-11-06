import { beforeEach, describe, expect, it, vi } from 'vitest';

const kit = vi.hoisted(() => ({
  init: vi.fn(),
  getAddress: vi.fn(),
  authModal: vi.fn(),
}));

vi.mock('@/lib/network-config', () => ({ getNetwork: () => 'testnet' }));
vi.mock('@creit.tech/stellar-wallets-kit', () => ({
  StellarWalletsKit: kit,
  Networks: { PUBLIC: 'public', TESTNET: 'testnet' },
}));
vi.mock('@creit.tech/stellar-wallets-kit/modules/freighter', () => ({ FreighterModule: class {} }));
vi.mock('@creit.tech/stellar-wallets-kit/modules/xbull', () => ({ xBullModule: class {} }));
vi.mock('@creit.tech/stellar-wallets-kit/modules/albedo', () => ({ AlbedoModule: class {} }));
vi.mock('@creit.tech/stellar-wallets-kit/modules/lobstr', () => ({ LobstrModule: class {} }));
vi.mock('@creit.tech/stellar-wallets-kit/modules/rabet', () => ({ RabetModule: class {} }));

describe('shared wallet initialization', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it('shares background initialization with simultaneous actions without prompting', async () => {
    const { preloadWalletKit, getWalletKit } = await import('../wallet-kit');
    preloadWalletKit();
    const [first, second] = await Promise.all([getWalletKit(), getWalletKit()]);
    expect(first).toBe(second);
    expect(kit.init).toHaveBeenCalledTimes(1);
    expect(kit.getAddress).not.toHaveBeenCalled();
    expect(kit.authModal).not.toHaveBeenCalled();
  });

  it('retries after failed background initialization', async () => {
    kit.init.mockImplementationOnce(() => {
      throw new Error('load failed');
    });
    const { preloadWalletKit, getWalletKit } = await import('../wallet-kit');
    preloadWalletKit();
    await expect(getWalletKit()).rejects.toThrow('load failed');
    await expect(getWalletKit()).resolves.toBe(kit);
    expect(kit.init).toHaveBeenCalledTimes(2);
  });

  it('reuses the kit address without reconnecting the profile wallet', async () => {
    kit.getAddress.mockResolvedValue({ address: 'connected-address' });
    const { getActiveWalletAddress } = await import('../wallet-kit');
    await expect(getActiveWalletAddress()).resolves.toBe('connected-address');
    expect(kit.authModal).not.toHaveBeenCalled();
  });

  it('opens authorization when no wallet is connected', async () => {
    kit.getAddress.mockRejectedValue(new Error('not connected'));
    kit.authModal.mockResolvedValue({ address: 'new-address' });
    const { getActiveWalletAddress } = await import('../wallet-kit');
    await expect(getActiveWalletAddress()).resolves.toBe('new-address');
    expect(kit.authModal).toHaveBeenCalledTimes(1);
  });
});
