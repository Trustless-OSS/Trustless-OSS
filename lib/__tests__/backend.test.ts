import { describe, expect, it } from 'vitest';
import { backendUrl, remoteBackendUrl } from '../backend';

describe('backendUrl', () => {
  it('uses the API path directly from the browser', () => {
    expect(backendUrl('/repos/sync-installation')).toBe('/api/v1/repos/sync-installation');
  });

  it('keeps the remote API origin for display and server-side calls', () => {
    expect(remoteBackendUrl()).toMatch(/^https?:\/\//);
  });
});
