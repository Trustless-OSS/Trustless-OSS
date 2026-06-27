import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  beginShutdown,
  isShuttingDown,
  trackActiveRequest,
  untrackActiveRequest,
  getActiveRequestCount,
  waitForActiveRequests,
  resetLifecycleState,
} from '../lifecycle.js';

describe('Lifecycle shutdown helpers', () => {
  beforeEach(() => {
    resetLifecycleState();
  });

  it('tracks and untracks active requests', () => {
    trackActiveRequest();
    trackActiveRequest();
    expect(getActiveRequestCount()).toBe(2);
    untrackActiveRequest();
    expect(getActiveRequestCount()).toBe(1);
  });

  it('beginShutdown sets shutting down flag', () => {
    beginShutdown();
    expect(isShuttingDown()).toBe(true);
  });

  it('waitForActiveRequests resolves when count reaches zero', async () => {
    trackActiveRequest();
    const waitPromise = waitForActiveRequests(5000);
    setTimeout(() => untrackActiveRequest(), 50);
    await expect(waitPromise).resolves.toBeUndefined();
    expect(getActiveRequestCount()).toBe(0);
  });

  it('waitForActiveRequests resolves after timeout even with active requests', async () => {
    trackActiveRequest();
    vi.useFakeTimers();
    const waitPromise = waitForActiveRequests(200);
    vi.advanceTimersByTime(250);
    await expect(waitPromise).resolves.toBeUndefined();
    vi.useRealTimers();
  });
});
