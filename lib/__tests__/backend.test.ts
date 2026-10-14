import { describe, expect, it } from 'vitest';
import { backendUrl, remoteBackendUrl } from '../backend';

describe('backendUrl', () => {
  it('uses the full backend URL for all calls', () => {
    expect(backendUrl('/repos/sync-installation')).toBe(
      'http://localhost:5000/api/v1/repos/sync-installation'
    );
  });

  it('keeps the remote API origin for display and server-side calls', () => {
    expect(remoteBackendUrl()).toMatch(/^https?:\/\//);
  });
});
