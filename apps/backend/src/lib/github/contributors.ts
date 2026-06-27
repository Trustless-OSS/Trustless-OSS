import { supabase } from '../supabase.js';
import { cache, CACHE_KEYS, CACHE_TTLS } from '../cache.js';
import { logger } from '../logger.js';
import type { Contributor } from '../../types/index.js';

const log = logger.child({ module: 'github-contributors' });

export async function getContributorByGithubId(githubUserId: number): Promise<Contributor | null> {
  const cacheKey = CACHE_KEYS.contributor(githubUserId);
  const cached = await cache.get<Contributor>(cacheKey);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from('contributors')
    .select('*')
    .eq('github_user_id', githubUserId)
    .single<Contributor>();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      log.error({ err: error, githubUserId }, 'DB error fetching contributor');
    }
    return null;
  }

  await cache.set(cacheKey, data, CACHE_TTLS.CONTRIBUTOR);
  return data;
}

export async function invalidateContributorCache(githubUserId: number): Promise<void> {
  await cache.invalidate(CACHE_KEYS.contributor(githubUserId));
}
