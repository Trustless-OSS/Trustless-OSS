import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  trackError,
  getErrorRates,
  trackHttpRequest,
  getPrometheusMetrics,
  performHealthCheck,
} from '../monitoring.js';
import { redisClient } from '../redis.js';

describe('Monitoring Utilities', () => {
  beforeEach(async () => {
    if (process.env.REDIS_URL) {
      await redisClient.del('app_errors');
    }
  });

  afterEach(async () => {
    if (process.env.REDIS_URL) {
      await redisClient.del('app_errors');
    }
  });

  describe('Error Tracking', () => {
    it('should track errors using sliding window', async () => {
      await trackError();
      await trackError();

      const rates = await getErrorRates();
      expect(rates.last_5m).toBe(2);
      expect(rates.last_1h).toBe(2);
    });
  });

  describe('HTTP Metrics Tracking', () => {
    it('should track requests and calculate durations correctly', () => {
      trackHttpRequest('GET', '/api/test', 200, 15);
      trackHttpRequest('GET', '/api/test', 200, 50);
      trackHttpRequest('POST', '/api/submit', 201, 120);

      const healthMock = {
        checks: {
          database: {
            status: 'ok',
            pool: { total: 5, idle: 3, waiting: 0 },
            database: { total_connections: 5, active_connections: 2, idle_connections: 3 },
          },
          redis: { status: 'ok', memory: { used_memory_bytes: 1024 } },
          queues: {
            total: { waiting: 0, active: 1, failed: 0 },
            queues: {
              webhooks: { status: 'ok', waiting: 0, active: 1, failed: 0 },
            },
          },
          trustless_work: { status: 'ok', latencyMs: 42 },
        },
      };

      const metricsText = getPrometheusMetrics(healthMock, 120, { last_5m: 2, last_1h: 5 });

      expect(metricsText).toContain('trustless_app_uptime_seconds 120');
      expect(metricsText).toContain('trustless_db_connected 1');
      expect(metricsText).toContain('trustless_redis_connected 1');
      expect(metricsText).toContain('trustless_redis_memory_used_bytes 1024');
      expect(metricsText).toContain('trustless_queue_depth_total{status="active"} 1');
      expect(metricsText).toContain('trustless_errors_total{window="5m"} 2');
      expect(metricsText).toContain('trustless_tw_api_latency_ms 42');

      // Check HTTP counters and histograms
      expect(metricsText).toContain(
        'trustless_http_requests_total{method="GET",route="/api/test",status="200"} 2'
      );
      expect(metricsText).toContain(
        'trustless_http_requests_total{method="POST",route="/api/submit",status="201"} 1'
      );
      expect(metricsText).toContain(
        'trustless_http_request_duration_ms_sum{method="GET",route="/api/test",status="200"} 65'
      );
      expect(metricsText).toContain(
        'trustless_http_request_duration_ms_count{method="GET",route="/api/test",status="200"} 2'
      );
    });
  });

  describe('Health Check Aggregator', () => {
    it('should return basic structure for liveness check immediately', async () => {
      const health = await performHealthCheck('liveness');
      expect(health.status).toBe('ok');
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.checks).toEqual({});
    });
  });
});
