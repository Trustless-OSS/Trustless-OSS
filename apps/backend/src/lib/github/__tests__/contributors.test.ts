import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getContributorByGithubId, invalidateContributorCache } from '../contributors.js';
import { cache, CACHE_KEYS, CACHE_TTLS } from '../../cache.js';
import { supabase } from '../../supabase.js';

vi.mock('../../cache.js', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    invalidate: vi.fn(),
  },
  CACHE_KEYS: {
    contributor: (id: number) => `contrib:${id}`,
  },
  CACHE_TTLS: { CONTRIBUTOR: 600 },
}));

vi.mock('../../supabase.js', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Cached contributor lookups', () => {
  const mockContributor = {
    id: 'contrib-uuid',
    github_user_id: 777,
    github_username: 'dev',
    stellar_wallet: 'GOLDWALLET',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached contributor on hit', async () => {
    vi.mocked(cache.get).mockResolvedValueOnce(mockContributor);

    const result = await getContributorByGithubId(777);

    expect(result).toEqual(mockContributor);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('fetches from DB and caches on miss', async () => {
    vi.mocked(cache.get).mockResolvedValueOnce(null);
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: mockContributor, error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(mockChain as any);

    const result = await getContributorByGithubId(777);

    expect(result).toEqual(mockContributor);
    expect(cache.set).toHaveBeenCalledWith(
      CACHE_KEYS.contributor(777),
      mockContributor,
      CACHE_TTLS.CONTRIBUTOR
    );
  });

  it('invalidates contributor cache immediately on wallet update', async () => {
    await invalidateContributorCache(777);

    expect(cache.invalidate).toHaveBeenCalledWith(CACHE_KEYS.contributor(777));
  });
});
