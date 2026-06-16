import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cache } from '../cache.js';
import { redisClient, checkRedisHealth } from '../redis';

describe('Cache Utility', () => {
  // Clear Redis before each test
  beforeEach(async () => {
    await redisClient.flushdb(); 
  });

  // Clean up after all tests
  afterEach(async () => {
    await redisClient.flushdb(); 
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
      // Wait 2 seconds for TTL to expire
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
      // Mock Redis to simulate failure
      const originalPing = redisClient.ping.bind(redisClient);
      vi.spyOn(redisClient, 'ping').mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await cache.get('some:key');
      expect(result).toBeNull();

      // Restore original ping
      redisClient.ping = originalPing;
    });

    it('should not throw on set when Redis is unavailable', async () => {
      const originalPing = redisClient.ping.bind(redisClient);
      vi.spyOn(redisClient, 'ping').mockRejectedValueOnce(new Error('Redis connection failed'));

      await expect(cache.set('test:key', 'value')).resolves.not.toThrow();

      // Restore original ping
      redisClient.ping = originalPing;
    });

    it('should not throw on invalidate when Redis is unavailable', async () => {
      const originalPing = redisClient.ping.bind(redisClient);
      vi.spyOn(redisClient, 'ping').mockRejectedValueOnce(new Error('Redis connection failed'));

      await expect(cache.invalidate('test:key')).resolves.not.toThrow();

      // Restore original ping
      redisClient.ping = originalPing;
    });
  });

  describe('Cache with different TTL values', () => {
    it('should use default TTL (300s) when not specified', async () => {
      await cache.set('test:default', 'default TTL');
      // Check TTL by getting it directly from Redis
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
