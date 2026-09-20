import { describe, expect, it } from 'vitest';
import { backendUrl, remoteBackendUrl } from '../backend';

describe('backendUrl', () => {
  it('uses the Next.js proxy from the browser in development', () => {
    expect(backendUrl('/api/repos/sync-installation')).toBe(
      '/api/backend/api/v1/repos/sync-installation'
    );
  });

  it('keeps the remote API origin for display and server-side calls', () => {
    expect(remoteBackendUrl()).toMatch(/^https?:\/\//);
  });
});
