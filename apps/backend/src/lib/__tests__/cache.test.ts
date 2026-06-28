import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const redisStore = new Map<string, string>();
const redisExpiry = new Map<string, number>();

vi.mock('../redis', () => ({
  redisClient: {
    get: vi.fn(async (key: string) => {
      const expiresAt = redisExpiry.get(key);
      if (expiresAt !== undefined && Date.now() >= expiresAt) {
        redisStore.delete(key);
        redisExpiry.delete(key);
        return null;
      }
      return redisStore.get(key) ?? null;
    }),
    set: vi.fn(async (key: string, value: string, ...args: Array<string | number>) => {
      redisStore.set(key, value);
      let ttlSeconds = 300;
      const exIndex = args.indexOf('EX');
      if (exIndex >= 0 && args[exIndex + 1] !== undefined) {
        ttlSeconds = Number(args[exIndex + 1]);
      }
      redisExpiry.set(key, Date.now() + ttlSeconds * 1000);
      return 'OK';
    }),
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (redisStore.delete(key)) deleted += 1;
        redisExpiry.delete(key);
      }
      return deleted;
    }),
    scan: vi.fn(async (_cursor: string, _match: string, pattern: string) => {
      void _cursor;
      void _match;
      const prefix = pattern.replace('*', '');
      const keys = [...redisStore.keys()].filter((key) => key.startsWith(prefix));
      return ['0', keys] as [string, string[]];
    }),
    ping: vi.fn(async () => 'PONG'),
    ttl: vi.fn(async (key: string) => {
      const expiresAt = redisExpiry.get(key);
      if (expiresAt === undefined) return -2;
      const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }),
    flushdb: vi.fn(async () => {
      redisStore.clear();
      redisExpiry.clear();
    }),
    quit: vi.fn(async () => 'OK'),
  },
  checkRedisHealth: vi.fn(async () => ({ status: 'ok' as const })),
  disconnectRedis: vi.fn(async () => undefined),
}));

import { cache, cacheInvalidateByPattern, getCacheStats, resetCacheStats } from '../cache.js';
import { redisClient } from '../redis';

describe('Cache Utility', () => {
  beforeEach(async () => {
    resetCacheStats();
    redisStore.clear();
    redisExpiry.clear();
    vi.clearAllMocks();
    vi.mocked(redisClient.ping).mockResolvedValue('PONG');
  });

  afterEach(async () => {
    resetCacheStats();
    redisStore.clear();
    redisExpiry.clear();
  });

  describe('cache.get() and cache.set()', () => {
    it('should store and retrieve a string value', async () => {
      await cache.set('test:string', 'hello world');
      const result = await cache.get<string>('test:string');
      expect(result).toBe('hello world');
    });

    it('should store and retrieve a JSON object', async () => {
      const obj = { id: 1, name: 'Alice', email: 'alice@example.com' };
      await cache.set('test:object', obj);
      const result = await cache.get<typeof obj>('test:object');
      expect(result).toEqual(obj);
    });

    it('should store and retrieve an array', async () => {
      const arr = [1, 2, 3, 4, 5];
      await cache.set('test:array', arr);
      const result = await cache.get<number[]>('test:array');
      expect(result).toEqual(arr);
    });

    it('should return null for non-existent key', async () => {
      const result = await cache.get('non:existent');
      expect(result).toBeNull();
    });

    it('should return null for expired key', async () => {
      await cache.set('test:ttl', 'expires soon', 1);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const result = await cache.get('test:ttl');
      expect(result).toBeNull();
    });

    it('should overwrite existing key with new value', async () => {
      await cache.set('test:key', 'first value');
      await cache.set('test:key', 'second value');
      const result = await cache.get<string>('test:key');
      expect(result).toBe('second value');
    });
  });

  describe('cache.invalidate()', () => {
    it('should invalidate (delete) a key', async () => {
      await cache.set('test:key', 'to be deleted');
      await cache.invalidate('test:key');
      const result = await cache.get('test:key');
      expect(result).toBeNull();
    });

    it('should not throw when invalidating non-existent key', async () => {
      await expect(cache.invalidate('non:existent')).resolves.not.toThrow();
    });
  });

  describe('Graceful fallback when Redis is down', () => {
    it('should return null from get when Redis is unavailable', async () => {
      vi.mocked(redisClient.ping).mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await cache.get('some:key');
      expect(result).toBeNull();
    });

    it('should not throw on set when Redis is unavailable', async () => {
      vi.mocked(redisClient.ping).mockRejectedValueOnce(new Error('Redis connection failed'));

      await expect(cache.set('test:key', 'value')).resolves.not.toThrow();
    });

    it('should not throw on invalidate when Redis is unavailable', async () => {
      vi.mocked(redisClient.ping).mockRejectedValueOnce(new Error('Redis connection failed'));

      await expect(cache.invalidate('test:key')).resolves.not.toThrow();
    });
  });

  describe('cacheInvalidateByPattern()', () => {
    it('should delete keys matching pattern via SCAN + DEL', async () => {
      redisStore.set('gh-token:1', '"t1"');
      redisStore.set('gh-token:2', '"t2"');
      redisStore.set('repo:1', '"r1"');

      vi.spyOn(redisClient, 'scan').mockResolvedValueOnce(['0', ['gh-token:1', 'gh-token:2']]);

      const deleted = await cacheInvalidateByPattern('gh-token:*');

      expect(deleted).toBe(2);
      expect(redisStore.has('gh-token:1')).toBe(false);
      expect(redisStore.has('repo:1')).toBe(true);
    });

    it('should paginate SCAN cursor until completion', async () => {
      redisStore.set('repo:1', '"v1"');
      redisStore.set('repo:2', '"v2"');

      vi.mocked(redisClient.scan)
        .mockResolvedValueOnce(['42', ['repo:1']])
        .mockResolvedValueOnce(['0', ['repo:2']]);

      const deleted = await cacheInvalidateByPattern('repo:*');

      expect(redisClient.scan).toHaveBeenCalledTimes(2);
      expect(deleted).toBe(2);
    });

    it('should return 0 when Redis is unavailable', async () => {
      vi.mocked(redisClient.ping).mockRejectedValueOnce(new Error('Redis connection failed'));

      const deleted = await cacheInvalidateByPattern('gh-token:*');
      expect(deleted).toBe(0);
    });
  });

  describe('Cache hit/miss stats', () => {
    it('should track hits and misses by cache type', async () => {
      redisStore.set('gh-token:123', JSON.stringify('token-value'));

      await cache.get('gh-token:123');
      await cache.get('gh-token:456');

      const stats = getCacheStats();
      expect(stats['gh-token'].hits).toBe(1);
      expect(stats['gh-token'].misses).toBe(1);
      expect(stats['gh-token'].hitRate).toBe(0.5);
    });
  });

  describe('Cache with different TTL values', () => {
    it('should use default TTL (300s) when not specified', async () => {
      await cache.set('test:default', 'default TTL');
      const ttl = await redisClient.ttl('test:default');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it('should use custom TTL when specified', async () => {
      await cache.set('test:custom', 'custom TTL', 60);
      const ttl = await redisClient.ttl('test:custom');
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });
});
