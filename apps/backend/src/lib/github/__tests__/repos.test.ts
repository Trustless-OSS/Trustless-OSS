import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getRepoById, invalidateRepoCache } from '../repos.js';
import { cache, CACHE_KEYS, CACHE_TTLS } from '../../cache.js';
import { supabase } from '../../supabase.js';

vi.mock('../../cache.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  CACHE_KEYS: {
    repo: (id: string) => `repo:${id}`,
    repoByGithubId: (id: number) => `repo:gh:${id}`,
    ghToken: (id: number) => `gh-token:${id}`,
  },
  CACHE_TTLS: { REPO: 300 },
}));

vi.mock('../../supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Cached repo lookups', () => {
  const mockRepo = {
    id: 'repo-uuid',
    github_repo_id: 12345,
    full_name: 'owner/repo',
    reward_low: 1,
    reward_medium: 2,
    reward_high: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached repo on hit', async () => {
    vi.mocked(cache.get).mockResolvedValueOnce(mockRepo);

    const result = await getRepoById('repo-uuid');

    expect(result).toEqual(mockRepo);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('fetches from DB and caches on miss', async () => {
    vi.mocked(cache.get).mockResolvedValueOnce(null);
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockRepo, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as any);

    const result = await getRepoById('repo-uuid');

    expect(result).toEqual(mockRepo);
    expect(cache.set).toHaveBeenCalledWith(CACHE_KEYS.repo('repo-uuid'), mockRepo, CACHE_TTLS.REPO);
    expect(cache.set).toHaveBeenCalledWith(
      CACHE_KEYS.repoByGithubId(12345),
      mockRepo,
      CACHE_TTLS.REPO
    );
  });

  it('invalidates repo cache keys immediately on settings update', async () => {
    await invalidateRepoCache('repo-uuid', 12345);

    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_KEYS.repo('repo-uuid'));
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_KEYS.repoByGithubId(12345));
    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_KEYS.ghToken(12345));
  });
});
