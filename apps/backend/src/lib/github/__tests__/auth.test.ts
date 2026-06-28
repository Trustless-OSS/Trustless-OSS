import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetRepoByGithubId = vi.fn();
const mockCacheGet = vi.fn();
const mockCacheSet = vi.fn();

vi.mock('../../cache.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../cache.js')>();
  return {
    ...actual,
    cache: {
      get: (...args: unknown[]) => mockCacheGet(...args),
      set: (...args: unknown[]) => mockCacheSet(...args),
      invalidate: vi.fn(),
    },
  };
});

vi.mock('../repos.js', () => ({
  getRepoByGithubId: (...args: unknown[]) => mockGetRepoByGithubId(...args),
  invalidateRepoCache: vi.fn(),
}));

vi.mock('@octokit/app', () => ({
  App: class MockApp {
    octokit = {
      request: vi.fn().mockResolvedValue({
        data: { token: 'fresh-installation-token' },
      }),
    };
  },
}));

import { getInstallationToken } from '../auth.js';
import { CACHE_KEYS, resetCacheStats } from '../../cache.js';

describe('getInstallationToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCacheStats();
    process.env.GITHUB_APP_ID = '12345';
    process.env.GITHUB_APP_PRIVATE_KEY =
      '-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----';
  });

  it('returns cached token without calling GitHub API', async () => {
    mockCacheGet.mockResolvedValueOnce('cached-token');

    const token = await getInstallationToken(999);

    expect(token).toBe('cached-token');
    expect(mockCacheGet).toHaveBeenCalledWith(CACHE_KEYS.ghToken(999));
    expect(mockGetRepoByGithubId).not.toHaveBeenCalled();
  });

  it('generates and caches token on cache miss', async () => {
    mockCacheGet.mockResolvedValueOnce(null);
    mockGetRepoByGithubId.mockResolvedValueOnce({
      id: 'repo-1',
      github_repo_id: 999,
      full_name: 'owner/repo',
      github_installation_id: 42,
    });

    const token = await getInstallationToken(999);

    expect(token).toBe('fresh-installation-token');
    expect(mockCacheSet).toHaveBeenCalledWith(
      CACHE_KEYS.ghToken(999),
      'fresh-installation-token',
      3480
    );
  });
});
