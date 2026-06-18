import { redisClient, checkRedisHealth } from './redis';
import { logger } from './logger.js';

const log = logger.child({ module: 'cache' });

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Generic Redis cache utility with get/set/invalidate functions.
 * Gracefully handles Redis being unavailable.
 */
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
        return null;
      }

      const value = await redisClient.get(key);
      if (value === null) {
        log.debug({ key }, 'cache miss');
        return null;
      }

      log.debug({ key }, 'cache hit');
      return JSON.parse(value) as T;
    } catch (error) {
      log.error({ err: error, key }, 'error getting cache key');
      return null;
    }
  },

  /**
   * Store a value in the cache with an optional TTL (default: 300s).
   * Silently fails if Redis is down.
   */
  async set<T>(key: string, value: T, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      // Validate TTL
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

export default cache;
