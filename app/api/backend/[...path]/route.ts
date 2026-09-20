import { NextRequest, NextResponse } from 'next/server';
import { remoteBackendUrl } from '@/lib/backend';

export const maxDuration = 180;

const PROXY_TIMEOUT_MS = 55_000;
const SYNC_PROXY_TIMEOUT_MS = 170_000;
const PROXY_ATTEMPTS = 3;

const HOP_BY_HOP = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorText(error: unknown) {
  if (!(error instanceof Error)) return '';
  const cause =
    'cause' in error && error.cause instanceof Error
      ? `${error.cause.name} ${error.cause.message}`
      : '';
  return `${error.name} ${error.message} ${cause}`;
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (error.name === 'TimeoutError' || error.name === 'AbortError') return true;
  return /operation was aborted|aborted due to timeout/i.test(errorText(error));
}

function normalizeBackendPath(path: string[]) {
  if (path[0] !== 'api') return path;
  if (path[1] === 'v1') return path;
  return ['api', 'v1', ...path.slice(1)];
}

function proxyTimeoutMs(path: string[], method: string) {
  const nextPath = normalizeBackendPath(path);
  if (method === 'POST' && nextPath.join('/') === 'api/v1/repos/sync-installation') {
    return SYNC_PROXY_TIMEOUT_MS;
  }
  return PROXY_TIMEOUT_MS;
}

function isRetryableNetworkError(error: unknown, method: string) {
  const haystack = errorText(error);
  if (!haystack) return false;
  if (isTimeoutError(error) && method !== 'GET' && method !== 'HEAD') return false;
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|UND_ERR_SOCKET|socket hang up|fetch failed|aborted|timeout/i.test(
    haystack
  );
}

async function proxy(request: NextRequest, path: string[]): Promise<Response> {
  const normalizedPath = normalizeBackendPath(path);
  const target = `${remoteBackendUrl()}/${normalizedPath.join('/')}${request.nextUrl.search}`;
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.delete('accept-encoding');

  const body =
    request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();

  let lastError: unknown;

  for (let attempt = 1; attempt <= PROXY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(target, {
        method: request.method,
        headers,
        body: body && body.byteLength > 0 ? body : undefined,
        cache: 'no-store',
        redirect: 'manual',
        signal: AbortSignal.timeout(proxyTimeoutMs(path, request.method)),
      });

      const outbound = new Headers();
      response.headers.forEach((value, key) => {
        if (!HOP_BY_HOP.has(key.toLowerCase())) {
          outbound.set(key, value);
        }
      });

      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: outbound,
      });
    } catch (error: unknown) {
      lastError = error;
      if (attempt < PROXY_ATTEMPTS && isRetryableNetworkError(error, request.method)) {
        await sleep(2000 * attempt);
        continue;
      }
      break;
    }
  }

  const detail = lastError instanceof Error ? lastError.message : 'connection reset';
  const timedOut = isTimeoutError(lastError);
  return NextResponse.json(
    {
      error: timedOut
        ? `${remoteBackendUrl()} did not respond in time.`
        : `${remoteBackendUrl()} is waking up or temporarily unavailable.`,
      detail,
    },
    { status: timedOut ? 504 : 502 }
  );
}

async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!path?.length) {
    return NextResponse.json({ error: 'Missing backend path' }, { status: 400 });
  }
  const normalizedPath = normalizeBackendPath(path);
  return proxy(request, normalizedPath);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
