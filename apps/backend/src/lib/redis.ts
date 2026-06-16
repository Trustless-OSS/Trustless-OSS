import IORedis from 'ioredis';

export const redisClient = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
});

export const checkRedisHealth = async (): Promise<{
  status: 'ok' | 'error' | 'disabled';
  message?: string;
}> => {
  try {
    const pong = await redisClient.ping();
    return pong === 'PONG' ? { status: 'ok' } : { status: 'error', message: 'ping/pong failed' };
  } catch (err: any) {
    return { status: 'error', message: err.message };
  }
};

export const disconnectRedis = async (): Promise<void> => {
  await redisClient.quit();
};
