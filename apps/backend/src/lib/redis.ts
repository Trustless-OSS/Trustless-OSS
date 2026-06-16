import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisConnection.on('error', (err) => {
  console.error('[Redis] Error connecting to Redis:', err);
});

redisConnection.on('connect', () => {
  console.log('[Redis] Connected to Redis successfully');
});
