// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(mainnetUrl?: string) {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_BACKEND_URL_MAINNET', mainnetUrl ?? '');
  return Promise.all([import('../network'), import('../backend')]);
}

afterEach(() => {
  vi.unstubAllEnvs();
  document.cookie = 'toss-network=; path=/; max-age=0';
});

describe('network selection', () => {
  it('shows mainnet as disabled and falls back to testnet', async () => {
    const [net] = await load();
    document.cookie = 'toss-network=mainnet; path=/';
    expect(net.NETWORKS).toEqual([
      { value: 'testnet', label: 'Testnet', disabled: false },
      { value: 'mainnet', label: 'Mainnet · Coming soon', disabled: true },
    ]);
    expect(net.getNetwork()).toBe('testnet');
  });

  it('stays on testnet even when a mainnet backend is configured', async () => {
    const [net, backend] = await load('https://main.example.com/');
    document.cookie = 'toss-network=mainnet; path=/';
    expect(net.getNetwork()).toBe('testnet');
    expect(backend.backendUrl('/repos')).not.toBe('https://main.example.com/api/v1/repos');
    expect(net.stellarExpertNetwork()).toBe('testnet');
  });

  it('ignores garbage cookie values', async () => {
    const [net] = await load('https://main.example.com');
    document.cookie = 'toss-network=evil; path=/';
    expect(net.getNetwork()).toBe('testnet');
  });
});
