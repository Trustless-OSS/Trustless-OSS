import { describe, it, expect } from 'vitest';
import { webhooksQueue, escrowOperationsQueue, syncQueue } from '../queue.js';

describe('BullMQ Queue Configuration & Lifecycle', () => {
  it('should define webhooksQueue with correct attempts, backoff, and retention options', () => {
    expect(webhooksQueue).toBeDefined();
    expect(webhooksQueue.opts.defaultJobOptions?.attempts).toBe(3);
    expect(webhooksQueue.opts.defaultJobOptions?.backoff).toEqual({
      type: 'exponential',
      delay: 1000,
    });
    expect(webhooksQueue.opts.defaultJobOptions?.removeOnComplete).toEqual({ age: 300 });
    expect(webhooksQueue.opts.defaultJobOptions?.removeOnFail).toEqual({ age: 86400 });
  });

  it('should define escrowOperationsQueue with correct attempts, backoff, and retention options', () => {
    expect(escrowOperationsQueue).toBeDefined();
    expect(escrowOperationsQueue.opts.defaultJobOptions?.attempts).toBe(5);
    expect(escrowOperationsQueue.opts.defaultJobOptions?.backoff).toEqual({
      type: 'exponential',
      delay: 2000,
    });
    expect(escrowOperationsQueue.opts.defaultJobOptions?.removeOnComplete).toEqual({ age: 300 });
    expect(escrowOperationsQueue.opts.defaultJobOptions?.removeOnFail).toEqual({ age: 86400 });
  });

  it('should define syncQueue with correct attempts, backoff, and retention options', () => {
    expect(syncQueue).toBeDefined();
    expect(syncQueue.opts.defaultJobOptions?.attempts).toBe(2);
    expect(syncQueue.opts.defaultJobOptions?.backoff).toEqual({
      type: 'exponential',
      delay: 5000,
    });
    expect(syncQueue.opts.defaultJobOptions?.removeOnComplete).toEqual({ age: 300 });
    expect(syncQueue.opts.defaultJobOptions?.removeOnFail).toEqual({ age: 86400 });
  });
});
