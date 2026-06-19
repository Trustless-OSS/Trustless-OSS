import pg from 'pg';
import { redisClient } from './redis.js';
import { registerErrorTracker, logger } from './logger.js';
import { webhooksQueue, escrowOperationsQueue, syncQueue } from './queue.js';
import { randomUUID } from 'crypto';

const { Pool } = pg;

const log = logger.child({ module: 'monitoring' });

let pool: pg.Pool | null = null;

export function getDbPool(): pg.Pool | null {
  if (!pool && process.env.DATABASE_URL) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.DATABASE_URL.includes('supabase') || process.env.NODE_ENV === 'production'
            ? { rejectUnauthorized: false }
            : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      pool.on('error', (err) => {
        log.error({ err }, 'Database pool background error');
      });
    } catch (err: any) {
      log.error({ err: err.message }, 'Failed to initialize database pool');
    }
  }
  return pool;
}

// Error tracking
const localErrorTimestamps: number[] = [];

export async function trackError() {
  const now = Date.now();
  localErrorTimestamps.push(now);

  // Prune local memory list (older than 1h)
  const oneHourAgo = now - 3600000;
  while (localErrorTimestamps.length > 0 && localErrorTimestamps[0] < oneHourAgo) {
    localErrorTimestamps.shift();
  }

  // If redis is connected and ready, track there too
  if (process.env.REDIS_URL && redisClient.status === 'ready') {
    try {
      const member = `${now}-${randomUUID()}`;
      await redisClient.zadd('app_errors', now, member);
      await redisClient.zremrangebyscore('app_errors', 0, oneHourAgo);
    } catch (e: any) {
      log.error({ err: e.message }, 'Failed to write error metric to Redis');
    }
  }
}

export async function getErrorRates() {
  const now = Date.now();
  const fiveMinAgo = now - 300000;
  const oneHourAgo = now - 3600000;

  if (process.env.REDIS_URL && redisClient.status === 'ready') {
    try {
      await redisClient.zremrangebyscore('app_errors', 0, oneHourAgo);
      const count5m = await redisClient.zcount('app_errors', fiveMinAgo, '+inf');
      const count1h = await redisClient.zcount('app_errors', oneHourAgo, '+inf');
      return {
        last_5m: count5m,
        last_1h: count1h,
      };
    } catch (e) {
      // fallback to local
    }
  }

  const count5m = localErrorTimestamps.filter((t) => t >= fiveMinAgo).length;
  const count1h = localErrorTimestamps.filter((t) => t >= oneHourAgo).length;
  return {
    last_5m: count5m,
    last_1h: count1h,
  };
}

// Register error tracking hook with the logger
registerErrorTracker(() => {
  void trackError();
});

// HTTP Request tracking for Prometheus
const httpRequestCounts = new Map<string, number>();
const httpRequestDurationSums = new Map<string, number>();
const httpRequestBuckets = new Map<string, Map<number, number>>();

const BUCKETS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

export function trackHttpRequest(
  method: string,
  route: string,
  status: number,
  durationMs: number
) {
  const key = `${method}:${route}:${status}`;

  // Update count
  const count = httpRequestCounts.get(key) || 0;
  httpRequestCounts.set(key, count + 1);

  // Update sum duration
  const sum = httpRequestDurationSums.get(key) || 0;
  httpRequestDurationSums.set(key, sum + durationMs);

  // Update buckets
  let buckets = httpRequestBuckets.get(key);
  if (!buckets) {
    buckets = new Map<number, number>();
    for (const b of BUCKETS) {
      buckets.set(b, 0);
    }
    httpRequestBuckets.set(key, buckets);
  }

  for (const b of BUCKETS) {
    if (durationMs <= b) {
      buckets.set(b, (buckets.get(b) || 0) + 1);
    }
  }
}

// Database check helper
export async function checkDbHealth() {
  const dbPool = getDbPool();
  if (!dbPool) {
    return {
      status: 'disabled' as const,
      message: 'DATABASE_URL is not configured',
    };
  }

  const startTime = Date.now();
  try {
    const client = await dbPool.connect();
    try {
      let stats = { total_connections: 0, active_connections: 0, idle_connections: 0 };
      try {
        const res = await client.query(`
          SELECT
            count(*)::int as total_connections,
            (count(*) FILTER (WHERE state = 'active'))::int as active_connections,
            (count(*) FILTER (WHERE state = 'idle'))::int as idle_connections
          FROM pg_stat_activity
          WHERE datname = current_database();
        `);
        if (res.rows && res.rows[0]) {
          stats = res.rows[0];
        }
      } catch (e: any) {
        // Fallback if role lacks permissions to read pg_stat_activity
        await client.query('SELECT 1');
      }

      return {
        status: 'ok' as const,
        latency: `${Date.now() - startTime}ms`,
        pool: {
          total: dbPool.totalCount,
          idle: dbPool.idleCount,
          waiting: dbPool.waitingCount,
        },
        database: {
          total_connections: stats.total_connections,
          active_connections: stats.active_connections,
          idle_connections: stats.idle_connections,
        },
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    return {
      status: 'error' as const,
      latency: `${Date.now() - startTime}ms`,
      message: err.message,
    };
  }
}

// Redis check helper
export async function checkRedisHealth() {
  if (!process.env.REDIS_URL) {
    return { status: 'disabled' as const };
  }
  const startTime = Date.now();
  try {
    if (redisClient.status !== 'ready') {
      return {
        status: 'error' as const,
        latency: `${Date.now() - startTime}ms`,
        message: `Redis client is not ready (status: ${redisClient.status})`,
      };
    }
    const pong = await redisClient.ping();
    if (pong !== 'PONG') {
      return {
        status: 'error' as const,
        latency: `${Date.now() - startTime}ms`,
        message: 'ping failed',
      };
    }

    let memory: any = undefined;
    if (typeof redisClient.info === 'function') {
      try {
        const info = await redisClient.info('memory');
        const lines = info.split('\r\n');
        const memoryStats: Record<string, string> = {};
        for (const line of lines) {
          const parts = line.split(':');
          if (parts.length === 2) {
            memoryStats[parts[0]] = parts[1];
          }
        }
        memory = {
          used_memory_bytes: memoryStats['used_memory']
            ? parseInt(memoryStats['used_memory'], 10)
            : undefined,
          used_memory_human: memoryStats['used_memory_human'] || undefined,
          used_memory_peak_bytes: memoryStats['used_memory_peak']
            ? parseInt(memoryStats['used_memory_peak'], 10)
            : undefined,
          used_memory_peak_human: memoryStats['used_memory_peak_human'] || undefined,
          used_memory_lua_bytes: memoryStats['used_memory_lua']
            ? parseInt(memoryStats['used_memory_lua'], 10)
            : undefined,
        };
      } catch (e) {
        // ignore memory parse error
      }
    }

    return {
      status: 'ok' as const,
      latency: `${Date.now() - startTime}ms`,
      memory,
    };
  } catch (err: any) {
    return {
      status: 'error' as const,
      latency: `${Date.now() - startTime}ms`,
      message: err.message,
    };
  }
}

// Queue check helper
export async function getQueueDepth() {
  // Bull queues live in Redis. If Redis is unconfigured or not ready, report
  // empty rather than issuing commands against a mock/disconnected connection.
  if (!process.env.REDIS_URL || redisClient.status !== 'ready') {
    return {
      status: 'disabled' as const,
      queues: {},
      total: {
        waiting: 0,
        active: 0,
        failed: 0,
      },
    };
  }

  const queues = [
    { name: 'webhooks', queue: webhooksQueue },
    { name: 'escrow-operations', queue: escrowOperationsQueue },
    { name: 'sync', queue: syncQueue },
  ];

  const results: Record<string, any> = {};
  let totalWaiting = 0;
  let totalActive = 0;
  let totalFailed = 0;

  for (const q of queues) {
    try {
      const counts = await q.queue.getJobCounts('waiting', 'active', 'failed');
      results[q.name] = {
        waiting: counts.waiting || 0,
        active: counts.active || 0,
        failed: counts.failed || 0,
      };
      totalWaiting += counts.waiting || 0;
      totalActive += counts.active || 0;
      totalFailed += counts.failed || 0;
    } catch (err: any) {
      results[q.name] = {
        status: 'error',
        message: err.message,
      };
    }
  }

  return {
    queues: results,
    total: {
      waiting: totalWaiting,
      active: totalActive,
      failed: totalFailed,
    },
  };
}

// Trustless Work latency check helper
export async function checkTrustlessWorkHealth() {
  const baseUrl = process.env.TRUSTLESS_WORK_BASE_URL ?? 'https://dev.api.trustlesswork.com';
  const apiKey = process.env.TRUSTLESS_WORK_API_KEY!;
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(`${baseUrl}/helper/health`, {
      method: 'HEAD',
      headers: {
        'x-api-key': apiKey,
      },
      signal: controller.signal,
    });
    const latency = Date.now() - startTime;
    return {
      status: response.ok ? ('ok' as const) : ('degraded' as const),
      statusCode: response.status,
      latency: `${latency}ms`,
      latencyMs: latency,
    };
  } catch (err: any) {
    return {
      status: 'error' as const,
      latency: `${Date.now() - startTime}ms`,
      message: err.message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Env vars the app needs to serve traffic; their absence makes readiness fail.
const REQUIRED_ENV_VARS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PLATFORM_STELLAR_PUBLIC_KEY',
  'GITHUB_BOT_TOKEN',
  'GITHUB_WEBHOOK_SECRET',
];

const APP_VERSION = process.env.APP_VERSION ?? process.env.npm_package_version ?? '1.0.0';
const HEALTH_CACHE_TTL_MS = parseInt(process.env.HEALTH_CACHE_TTL_MS ?? '5000', 10);
const HEALTH_CHECK_TIMEOUT_MS = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS ?? '4500', 10);

// Resolve with a fallback value if `promise` doesn't settle within `ms`, so a
// single hung dependency can't blow the overall <5s health budget.
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: () => T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback()), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback());
      }
    );
  });
}

function buildBaseHealth() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    version: APP_VERSION,
    uptime: process.uptime(),
    checks: {} as Record<string, any>,
  };
}

let readinessCache: { result: any; expiresAt: number } | null = null;
let readinessInFlight: Promise<any> | null = null;

// Health check aggregator. Liveness is instant (no external deps — a dependency
// blip must not fail liveness probes). Readiness runs all dependency checks,
// cached briefly so frequent probes stay <500ms, and hard-capped so the full
// sweep always completes in <5s even if a dependency hangs.
export async function performHealthCheck(type = 'readiness') {
  if (type === 'liveness') {
    return buildBaseHealth();
  }

  const now = Date.now();
  if (readinessCache && readinessCache.expiresAt > now) {
    return readinessCache.result;
  }
  // Coalesce concurrent readiness probes onto a single in-flight check.
  if (readinessInFlight) {
    return readinessInFlight;
  }

  readinessInFlight = computeReadiness()
    .then((result) => {
      readinessCache = { result, expiresAt: Date.now() + HEALTH_CACHE_TTL_MS };
      return result;
    })
    .finally(() => {
      readinessInFlight = null;
    });

  return readinessInFlight;
}

async function computeReadiness() {
  const health = buildBaseHealth();
  const isProd = (process.env.NODE_ENV || 'development') === 'production';
  const requiredVarsMissing = REQUIRED_ENV_VARS.filter((v) => !process.env[v]);

  try {
    const [db, redis, queues, tw, errors] = await Promise.all([
      withTimeout<any>(checkDbHealth(), HEALTH_CHECK_TIMEOUT_MS, () => ({
        status: 'error',
        message: 'database health check timed out',
      })),
      withTimeout<any>(checkRedisHealth(), HEALTH_CHECK_TIMEOUT_MS, () => ({
        status: 'error',
        message: 'redis health check timed out',
      })),
      withTimeout<any>(getQueueDepth(), HEALTH_CHECK_TIMEOUT_MS, () => ({
        status: 'error',
        queues: {},
        total: { waiting: 0, active: 0, failed: 0 },
      })),
      withTimeout<any>(checkTrustlessWorkHealth(), HEALTH_CHECK_TIMEOUT_MS, () => ({
        status: 'error',
        message: 'trustless work health check timed out',
      })),
      withTimeout<any>(getErrorRates(), HEALTH_CHECK_TIMEOUT_MS, () => ({
        last_5m: 0,
        last_1h: 0,
      })),
    ]);

    health.checks.database = db;
    health.checks.redis = redis;
    health.checks.queues = queues;
    health.checks.trustless_work = tw;
    health.checks.errors = errors;
    health.checks.environment = {
      status: requiredVarsMissing.length === 0 ? 'ok' : 'error',
      missing_variables: requiredVarsMissing.length > 0 ? requiredVarsMissing : undefined,
    };

    // DB and Redis are critical → 503 when down. A hard error is always
    // unhealthy; a 'disabled' (unconfigured) critical dependency is only
    // tolerated outside production.
    const dbDown = db.status === 'error' || (db.status === 'disabled' && isProd);
    const redisDown = redis.status === 'error' || (redis.status === 'disabled' && isProd);

    const isHealthy = !dbDown && !redisDown && requiredVarsMissing.length === 0;
    health.status = isHealthy ? 'ok' : 'unhealthy';
  } catch (err: any) {
    health.status = 'unhealthy';
    (health as any).error = err.message;
  }

  return health;
}

// Format to Prometheus
export function getPrometheusMetrics(
  health: any,
  uptime: number,
  errorRates: { last_5m: number; last_1h: number }
): string {
  const lines: string[] = [];

  // Uptime
  lines.push('# HELP trustless_app_uptime_seconds Uptime of the application in seconds');
  lines.push('# TYPE trustless_app_uptime_seconds gauge');
  lines.push(`trustless_app_uptime_seconds ${uptime}`);

  // Database
  if (health.checks?.database) {
    lines.push(
      '# HELP trustless_db_connected Is the database connected (1 = ok, 0 = error/disabled)'
    );
    lines.push('# TYPE trustless_db_connected gauge');
    lines.push(`trustless_db_connected ${health.checks.database.status === 'ok' ? 1 : 0}`);

    if (health.checks.database.pool) {
      lines.push('# HELP trustless_db_pool_connections Current connection pool stats');
      lines.push('# TYPE trustless_db_pool_connections gauge');
      lines.push(
        `trustless_db_pool_connections{type="total"} ${health.checks.database.pool.total}`
      );
      lines.push(`trustless_db_pool_connections{type="idle"} ${health.checks.database.pool.idle}`);
      lines.push(
        `trustless_db_pool_connections{type="waiting"} ${health.checks.database.pool.waiting}`
      );
    }

    if (health.checks.database.database) {
      lines.push('# HELP trustless_db_server_connections Database server connections');
      lines.push('# TYPE trustless_db_server_connections gauge');
      lines.push(
        `trustless_db_server_connections{type="total"} ${health.checks.database.database.total_connections}`
      );
      lines.push(
        `trustless_db_server_connections{type="active"} ${health.checks.database.database.active_connections}`
      );
      lines.push(
        `trustless_db_server_connections{type="idle"} ${health.checks.database.database.idle_connections}`
      );
    }
  }

  // Redis
  if (health.checks?.redis) {
    lines.push('# HELP trustless_redis_connected Is Redis connected (1 = ok, 0 = error/disabled)');
    lines.push('# TYPE trustless_redis_connected gauge');
    lines.push(`trustless_redis_connected ${health.checks.redis.status === 'ok' ? 1 : 0}`);

    if (health.checks.redis.memory && health.checks.redis.memory.used_memory_bytes !== undefined) {
      lines.push('# HELP trustless_redis_memory_used_bytes Redis memory usage in bytes');
      lines.push('# TYPE trustless_redis_memory_used_bytes gauge');
      lines.push(
        `trustless_redis_memory_used_bytes ${health.checks.redis.memory.used_memory_bytes}`
      );
    }
  }

  // Queues
  if (health.checks?.queues) {
    lines.push('# HELP trustless_queue_depth_total Total number of jobs in all queues');
    lines.push('# TYPE trustless_queue_depth_total gauge');
    lines.push(
      `trustless_queue_depth_total{status="waiting"} ${health.checks.queues.total.waiting}`
    );
    lines.push(`trustless_queue_depth_total{status="active"} ${health.checks.queues.total.active}`);
    lines.push(`trustless_queue_depth_total{status="failed"} ${health.checks.queues.total.failed}`);

    lines.push('# HELP trustless_queue_depth Jobs in queues by queue name and status');
    lines.push('# TYPE trustless_queue_depth gauge');
    for (const [qName, qData] of Object.entries(health.checks.queues.queues)) {
      const q = qData as any;
      if (q.status !== 'error') {
        lines.push(`trustless_queue_depth{queue="${qName}",status="waiting"} ${q.waiting}`);
        lines.push(`trustless_queue_depth{queue="${qName}",status="active"} ${q.active}`);
        lines.push(`trustless_queue_depth{queue="${qName}",status="failed"} ${q.failed}`);
      }
    }
  }

  // Errors
  lines.push('# HELP trustless_errors_total Recent error rates');
  lines.push('# TYPE trustless_errors_total gauge');
  lines.push(`trustless_errors_total{window="5m"} ${errorRates.last_5m}`);
  lines.push(`trustless_errors_total{window="1h"} ${errorRates.last_1h}`);

  // Trustless Work API Latency
  if (health.checks?.trustless_work && health.checks.trustless_work.latencyMs !== undefined) {
    lines.push('# HELP trustless_tw_api_latency_ms Latency of Trustless Work API in milliseconds');
    lines.push('# TYPE trustless_tw_api_latency_ms gauge');
    lines.push(`trustless_tw_api_latency_ms ${health.checks.trustless_work.latencyMs}`);
  }

  // HTTP Request metrics
  lines.push('# HELP trustless_http_requests_total Total number of HTTP requests');
  lines.push('# TYPE trustless_http_requests_total counter');
  for (const [key, count] of httpRequestCounts.entries()) {
    const [method, route, status] = key.split(':');
    lines.push(
      `trustless_http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`
    );
  }

  // HTTP Request Duration histogram
  lines.push('# HELP trustless_http_request_duration_ms Duration of HTTP requests in milliseconds');
  lines.push('# TYPE trustless_http_request_duration_ms histogram');
  for (const [key, sum] of httpRequestDurationSums.entries()) {
    const [method, route, status] = key.split(':');
    const count = httpRequestCounts.get(key) || 0;
    const buckets = httpRequestBuckets.get(key);

    if (buckets) {
      for (const b of BUCKETS) {
        const bCount = buckets.get(b) || 0;
        lines.push(
          `trustless_http_request_duration_ms_bucket{method="${method}",route="${route}",status="${status}",le="${b}"} ${bCount}`
        );
      }
    }
    // +inf bucket
    lines.push(
      `trustless_http_request_duration_ms_bucket{method="${method}",route="${route}",status="${status}",le="+Inf"} ${count}`
    );
    // sum
    lines.push(
      `trustless_http_request_duration_ms_sum{method="${method}",route="${route}",status="${status}"} ${sum}`
    );
    // count
    lines.push(
      `trustless_http_request_duration_ms_count{method="${method}",route="${route}",status="${status}"} ${count}`
    );
  }

  return lines.join('\n') + '\n';
}

// Clean up DB pool on shutdown
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
