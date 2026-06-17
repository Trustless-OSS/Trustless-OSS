import IORedis from 'ioredis-mock';
import { jest } from '@jest/globals';

// Mock the ioredis module to use ioredis-mock instead of the real one.
jest.unstable_mockModule('ioredis', () => {
  return {
    __esModule: true,
    default: IORedis,
  };
});

const originalEnv = process.env;

describe('Redis Client', () => {
  beforeEach(() => {
    // Reset modules and environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  it('should create a disabled client if REDIS_URL is not set', async () => {
    delete process.env.REDIS_URL;
    const { redisClient, checkRedisHealth } = await import('./redis.js');

    // The mock client should have a ping method
    expect(typeof redisClient.ping).toBe('function');
    const health = await checkRedisHealth();
    expect(health.status).toBe('disabled');
  });

  it('should create a client and connect if REDIS_URL is set', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const { redisClient, checkRedisHealth } = await import('./redis.js');

    // ioredis-mock connects synchronously and sets status to 'ready'
    expect(redisClient.status).toBe('ready');

    const health = await checkRedisHealth();
    expect(health.status).toBe('ok');
  });

  it('should handle ping command correctly', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const { redisClient } = await import('./redis.js');
    await expect(redisClient.ping()).resolves.toBe('PONG');
  });

  it('should gracefully disconnect', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const { redisClient, disconnectRedis } = await import('./redis.js');

    expect(redisClient.status).toBe('ready');
    await disconnectRedis();
    expect(redisClient.status).toBe('end');
  });

  it('health check should report an error if ping fails', async () => {
    process.env.REDIS_URL = 'redis://localhost:6379';
    const { redisClient, checkRedisHealth } = await import('./redis.js');

    // Force the ping command to fail for this test
    jest.spyOn(redisClient, 'ping').mockRejectedValue(new Error('Redis is down'));

    const health = await checkRedisHealth();
    expect(health.status).toBe('error');
    expect(health.message).toBe('Redis is down');
  });
});
