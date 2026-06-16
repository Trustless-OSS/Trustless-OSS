import IORedis from 'ioredis';

let client: IORedis;
let status: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';

if (process.env.REDIS_URL) {
  client = new IORedis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    // The client will attempt to reconnect automatically on error.
  });

  status = 'connecting';

  client.on('connect', () => {
    console.log('[Redis] Client connecting...');
  });

  client.on('ready', () => {
    status = 'connected';
    console.log('[Redis] ✅ Client connected successfully and ready to use.');
  });

  client.on('error', (err) => {
    status = 'error';
    console.error('[Redis] ❌ Connection error:', err.message);
    // Don't crash the app, ioredis will try to reconnect.
  });

  client.on('close', () => {
    status = 'disconnected';
    console.log('[Redis] Connection closed.');
  });

  client.on('reconnecting', () => {
    status = 'connecting';
    console.log('[Redis] Client is reconnecting...');
  });
} else {
  console.warn('[Redis] REDIS_URL not set, Redis client is disabled.');
  // Create a mock client to avoid errors if it's called during development
  client = {
    ping: () => Promise.resolve('PONG'),
  } as any;
  status = 'disconnected';
}

export const redisClient = client;

export const checkRedisHealth = async (): Promise<{
  status: 'ok' | 'error' | 'disabled';
  message?: string;
}> => {
  if (!process.env.REDIS_URL) {
    return { status: 'disabled' };
  }
  try {
    const pong = await redisClient.ping();
    return pong === 'PONG' ? { status: 'ok' } : { status: 'error', message: 'ping/pong failed' };
  } catch (err: any) {
    return { status: 'error', message: err.message };
  }
};

export const disconnectRedis = async (): Promise<void> => {
  if (status === 'connected' || status === 'connecting') {
    await redisClient.quit();
  }
};