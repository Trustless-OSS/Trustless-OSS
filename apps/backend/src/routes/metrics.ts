import type { IncomingMessage, ServerResponse } from 'http';
import { performHealthCheck, getPrometheusMetrics } from '../lib/monitoring.js';

export async function metricsHandler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // Optional bearer-token guard. Prometheus supports `bearer_token` in scrape
  // config; when METRICS_TOKEN is set we require it so internal metrics aren't
  // exposed publicly. When unset (e.g. local dev) the endpoint stays open.
  const expected = process.env.METRICS_TOKEN;
  if (expected) {
    const auth = req.headers.authorization;
    const provided = auth?.startsWith('Bearer ') ? auth.slice(7) : undefined;
    if (provided !== expected) {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      res.end('Unauthorized');
      return;
    }
  }

  try {
    const health = await performHealthCheck('readiness');
    const uptime = process.uptime();
    // Reuse the error rates already gathered by the readiness check rather than
    // issuing a second Redis round-trip.
    const errorRates = health.checks?.errors ?? { last_5m: 0, last_1h: 0 };
    const prometheusText = getPrometheusMetrics(health, uptime, errorRates);

    res.writeHead(200, { 'Content-Type': 'text/plain; version=0.0.4; charset=utf-8' });
    res.end(prometheusText);
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(`Error gathering metrics: ${err.message}`);
  }
}
