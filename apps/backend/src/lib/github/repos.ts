import { supabase } from '../supabase.js';
import { cache, CACHE_KEYS, CACHE_TTLS } from '../cache.js';
import { logger } from '../logger.js';
import type { Repo } from '../../types/index.js';

const log = logger.child({ module: 'github-repos' });

export async function getRepoById(repoId: string): Promise<Repo | null> {
  const cacheKey = CACHE_KEYS.repo(repoId);
  const cached = await cache.get<Repo>(cacheKey);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase.from('repos').select('*').eq('id', repoId).single<Repo>();

  if (error || !data) {
    if (error) {
      log.error({ err: error, repoId }, 'DB error fetching repo by id');
    }
    return null;
  }

  await cache.set(cacheKey, data, CACHE_TTLS.REPO);
  await cache.set(CACHE_KEYS.repoByGithubId(data.github_repo_id), data, CACHE_TTLS.REPO);
  return data;
}

export async function getRepoByGithubId(githubRepoId: number): Promise<Repo | null> {
  const cacheKey = CACHE_KEYS.repoByGithubId(githubRepoId);
  const cached = await cache.get<Repo>(cacheKey);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from('repos')
    .select('*')
    .eq('github_repo_id', githubRepoId)
    .single<Repo>();

  if (error || !data) {
    if (error) {
      log.error({ err: error, githubRepoId }, 'DB error fetching repo by github id');
    }
    return null;
  }

  await cache.set(cacheKey, data, CACHE_TTLS.REPO);
  await cache.set(CACHE_KEYS.repo(data.id), data, CACHE_TTLS.REPO);
  return data;
}

export async function invalidateRepoCache(
  repoId: string,
  githubRepoId?: number | null
): Promise<void> {
  await cache.invalidate(CACHE_KEYS.repo(repoId));
  if (githubRepoId !== undefined && githubRepoId !== null) {
    await cache.invalidate(CACHE_KEYS.repoByGithubId(githubRepoId));
    await cache.invalidate(CACHE_KEYS.ghToken(githubRepoId));
  }
}
