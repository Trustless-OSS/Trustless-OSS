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
  it('hides mainnet and falls back to testnet when no mainnet backend is configured', async () => {
    const [net] = await load();
    document.cookie = 'toss-network=mainnet; path=/';
    expect(net.NETWORKS.map((n) => n.value)).toEqual(['testnet']);
    expect(net.getNetwork()).toBe('testnet');
  });

  it('routes to the mainnet backend when the cookie selects mainnet', async () => {
    const [net, backend] = await load('https://main.example.com/');
    document.cookie = 'toss-network=mainnet; path=/';
    expect(net.getNetwork()).toBe('mainnet');
    expect(backend.backendUrl('/repos')).toBe('https://main.example.com/api/v1/repos');
    expect(net.stellarExpertNetwork()).toBe('public');
  });

  it('ignores garbage cookie values', async () => {
    const [net] = await load('https://main.example.com');
    document.cookie = 'toss-network=evil; path=/';
    expect(net.getNetwork()).toBe('testnet');
  });
});
