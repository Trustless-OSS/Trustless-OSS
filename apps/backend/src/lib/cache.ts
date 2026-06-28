import { redisClient, checkRedisHealth } from './redis';
import { logger } from './logger.js';

const log = logger.child({ module: 'cache' });

const DEFAULT_TTL = 300; // 5 minutes

export const CACHE_KEYS = {
  ghToken: (repoId: number) => `gh-token:${repoId}`,
  repo: (repoId: string) => `repo:${repoId}`,
  repoByGithubId: (githubRepoId: number) => `repo:gh:${githubRepoId}`,
  contributor: (githubUserId: number) => `contrib:${githubUserId}`,
} as const;

export const CACHE_TTLS = {
  GH_TOKEN: 58 * 60, // 58 minutes
  REPO: 300, // 5 minutes
  CONTRIBUTOR: 600, // 10 minutes
} as const;

type CacheType = 'gh-token' | 'repo' | 'contrib' | 'other';

interface CacheTypeStats {
  hits: number;
  misses: number;
}

const statsByType: Record<CacheType, CacheTypeStats> = {
  'gh-token': { hits: 0, misses: 0 },
  repo: { hits: 0, misses: 0 },
  contrib: { hits: 0, misses: 0 },
  other: { hits: 0, misses: 0 },
};

function resolveCacheType(key: string): CacheType {
  if (key.startsWith('gh-token:')) return 'gh-token';
  if (key.startsWith('repo:')) return 'repo';
  if (key.startsWith('contrib:')) return 'contrib';
  return 'other';
}

function recordHit(key: string): void {
  statsByType[resolveCacheType(key)].hits += 1;
}

function recordMiss(key: string): void {
  statsByType[resolveCacheType(key)].misses += 1;
}

export function getCacheStats(): Record<CacheType, CacheTypeStats & { hitRate: number | null }> {
  const result = {} as Record<CacheType, CacheTypeStats & { hitRate: number | null }>;

  for (const [type, stats] of Object.entries(statsByType) as [CacheType, CacheTypeStats][]) {
    const total = stats.hits + stats.misses;
    result[type] = {
      ...stats,
      hitRate: total > 0 ? stats.hits / total : null,
    };
  }

  return result;
}

export function resetCacheStats(): void {
  for (const type of Object.keys(statsByType) as CacheType[]) {
    statsByType[type] = { hits: 0, misses: 0 };
  }
}

export const cache = {
  /**
   * Retrieve a cached value by key.
   * Returns null if the key doesn't exist, Redis is down, or an error occurs.
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const health = await checkRedisHealth();
      if (health.status !== 'ok') {
        log.warn({ key }, 'Redis unavailable, cache miss');
        recordMiss(key);
        return null;
      }

      const value = await redisClient.get(key);
      if (value === null) {
        log.debug({ key }, 'cache miss');
        recordMiss(key);
        return null;
      }

      log.debug({ key }, 'cache hit');
      recordHit(key);
      return JSON.parse(value) as T;
    } catch (error) {
      log.error({ err: error, key }, 'error getting cache key');
      recordMiss(key);
      return null;
    }
  },

  /**
   * Store a value in the cache with an optional TTL (default: 300s).
   * Silently fails if Redis is down.
   */
  async set<T>(key: string, value: T, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const validTtl = Number(ttl);
      if (!Number.isFinite(validTtl) || validTtl <= 0) {
        log.warn({ key, ttl }, 'invalid TTL provided, using default');
        ttl = DEFAULT_TTL;
      }

      const health = await checkRedisHealth();
      if (health.status !== 'ok') {
        log.warn({ key }, 'Redis unavailable, cache set skipped');
        return;
      }

      const serialized = JSON.stringify(value);
      await redisClient.set(key, serialized, 'EX', ttl);
      log.debug({ key, ttl }, 'cache set');
    } catch (error) {
      log.error({ err: error, key }, 'error setting cache key');
    }
  },

  /**
   * Invalidate (delete) a cached value by key.
   * Silently fails if Redis is down.
   */
  async invalidate(key: string): Promise<void> {
    try {
      const health = await checkRedisHealth();
      if (health.status !== 'ok') {
        log.warn({ key }, 'Redis unavailable, cache invalidate skipped');
        return;
      }

      await redisClient.del(key);
      log.debug({ key }, 'cache invalidated');
    } catch (error) {
      log.error({ err: error, key }, 'error invalidating cache key');
    }
  },
};

/**
 * Bulk invalidate keys matching a pattern using SCAN + DEL (never KEYS).
 * Silently fails if Redis is down.
 */
export async function cacheInvalidateByPattern(pattern: string): Promise<number> {
  try {
    const health = await checkRedisHealth();
    if (health.status !== 'ok') {
      log.warn({ pattern }, 'Redis unavailable, pattern invalidation skipped');
      return 0;
    }

    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        const removed = await redisClient.del(...keys);
        deleted += removed;
      }
    } while (cursor !== '0');

    log.debug({ pattern, deleted }, 'cache pattern invalidated');
    return deleted;
  } catch (error) {
    log.error({ err: error, pattern }, 'error invalidating cache by pattern');
    return 0;
  }
}

export default cache;
