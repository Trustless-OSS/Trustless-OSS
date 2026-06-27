import { logger } from './logger.js';

const log = logger.child({ module: 'lifecycle' });

let shuttingDown = false;
let activeRequests = 0;

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function beginShutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info('Shutdown initiated — rejecting new requests with 503');
}

export function trackActiveRequest(): void {
  activeRequests += 1;
}

export function untrackActiveRequest(): void {
  activeRequests = Math.max(0, activeRequests - 1);
}

export function getActiveRequestCount(): number {
  return activeRequests;
}

export function waitForActiveRequests(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    if (activeRequests === 0) {
      resolve();
      return;
    }

    log.info({ activeRequests, timeoutMs }, 'Waiting for in-flight HTTP requests to complete');

    const start = Date.now();
    const interval = setInterval(() => {
      if (activeRequests === 0) {
        clearInterval(interval);
        log.info('All in-flight HTTP requests completed');
        resolve();
        return;
      }

      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        log.warn({ activeRequests, timeoutMs }, 'Timed out waiting for in-flight HTTP requests');
        resolve();
      }
    }, 100);
  });
}

export function closeDatabaseConnection(): void {
  // Supabase JS client uses HTTP — no persistent connection to close.
  log.info(
    'Database connection cleanup complete (Supabase HTTP client — no persistent connection)'
  );
}

/** @internal Test helper — resets shutdown state between test runs */
export function resetLifecycleState(): void {
  shuttingDown = false;
  activeRequests = 0;
}
