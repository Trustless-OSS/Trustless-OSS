import { redisClient, checkRedisHealth } from './redis';

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
        console.warn(`[Cache] Redis unavailable, cache miss for key: ${key}`);
        return null;
      }

      const value = await redisClient.get(key);
      if (value === null) {
        console.log(`[Cache] Miss: ${key}`);
        return null;
      }

      console.log(`[Cache] Hit: ${key}`);
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[Cache] Error getting key "${key}":`, error);
      return null;
    }
  },

  /**
   * Store a value in the cache with an optional TTL (default: 300s).
   * Silently fails if Redis is down.
   */
  async set<T>(key: string, value: T, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      const health = await checkRedisHealth();
      if (health.status !== 'ok') {
        console.warn(`[Cache] Redis unavailable, cache set skipped for key: ${key}`);
        return;
      }

      const serialized = JSON.stringify(value);
      await redisClient.set(key, serialized, 'EX', ttl);
      console.log(`[Cache] Set: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`[Cache] Error setting key "${key}":`, error);
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
        console.warn(`[Cache] Redis unavailable, cache invalidate skipped for key: ${key}`);
        return;
      }

      await redisClient.del(key);
      console.log(`[Cache] Invalidated: ${key}`);
    } catch (error) {
      console.error(`[Cache] Error invalidating key "${key}":`, error);
    }
  },
};

export default cache;
