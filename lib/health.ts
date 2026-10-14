import { backendUrl, remoteBackendUrl } from '@/lib/backend';

export const STATUS_PAGE_URL = 'https://stats.uptimerobot.com/eEV8dUAe3D';

export type HealthStatus = 'checking' | 'ok' | 'waking' | 'down';

export type FailedDependency = 'redis' | 'database' | null;

export type HealthSnapshot = {
  status: Exclude<HealthStatus, 'checking' | 'waking'>;
  service: string | null;
  message: string;
  latencyMs: number | null;
  backendHost: string | null;
  failedDependency: FailedDependency;
  checkedAt: string;
};

type CheckPayload = {
  status?: unknown;
  message?: unknown;
};

type BackendHealthPayload = {
  status?: unknown;
  service?: unknown;
  message?: unknown;
  checks?: {
    redis?: CheckPayload;
    database?: CheckPayload;
  };
};

function checkStatus(check: CheckPayload | undefined): string | null {
  return typeof check?.status === 'string' ? check.status.toLowerCase() : null;
}

function checkMessage(check: CheckPayload | undefined): string | null {
  return typeof check?.message === 'string' ? check.message : null;
}

export function backendHost(): string | null {
  try {
    return new URL(remoteBackendUrl()).host;
  } catch {
    return null;
  }
}

export function isPersistentDependencyFailure(snapshot: HealthSnapshot): boolean {
  return snapshot.failedDependency === 'redis' || snapshot.failedDependency === 'database';
}

export function parseHealthPayload(
  payload: unknown,
  httpOk: boolean,
  latencyMs: number
): HealthSnapshot {
  const body = payload && typeof payload === 'object' ? (payload as BackendHealthPayload) : null;
  const service = typeof body?.service === 'string' ? body.service : null;
  const redisFailed = checkStatus(body?.checks?.redis) === 'error';
  const databaseFailed = checkStatus(body?.checks?.database) === 'error';
  const failedDependency: FailedDependency = redisFailed
    ? 'redis'
    : databaseFailed
      ? 'database'
      : null;
  const reportedOk = typeof body?.status === 'string' && body.status.toLowerCase() === 'ok';
  const host = backendHost();

  let message: string;
  if (typeof body?.message === 'string') {
    message = body.message;
  } else if (redisFailed) {
    message = `${host ?? 'The API'} is up, but Redis is unavailable (${checkMessage(body?.checks?.redis) ?? 'Redis unavailable'}).`;
  } else if (databaseFailed) {
    message = `${host ?? 'The API'} is up, but the database is unavailable.`;
  } else if (httpOk) {
    message = 'API reachable';
  } else {
    message = 'API did not respond';
  }

  return {
    status: httpOk && (body ? reportedOk : true) ? 'ok' : 'down',
    service,
    message,
    latencyMs,
    backendHost: host,
    failedDependency,
    checkedAt: new Date().toISOString(),
  };
}

export async function fetchBackendHealth(timeoutMs = 55_000): Promise<HealthSnapshot> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(backendUrl('/api/v1/health'), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    const latencyMs = Date.now() - started;
    const payload: unknown = await response.json().catch(() => null);
    return parseHealthPayload(payload, response.ok, latencyMs);
  } catch {
    return {
      status: 'down',
      service: null,
      message: 'API unreachable or still cold-starting',
      latencyMs: Date.now() - started,
      backendHost: backendHost(),
      failedDependency: null,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForBackendReady(timeoutMs = 45_000): Promise<HealthSnapshot> {
  const deadline = Date.now() + timeoutMs;
  let last = await fetchBackendHealth(Math.min(15_000, timeoutMs));
  if (last.status === 'ok' || isPersistentDependencyFailure(last)) {
    return last;
  }

  while (Date.now() < deadline) {
    await sleep(3000);
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    last = await fetchBackendHealth(Math.min(15_000, remaining));
    if (last.status === 'ok' || isPersistentDependencyFailure(last)) {
      return last;
    }
  }

  return last;
}
