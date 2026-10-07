const REMOTE_BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(
  /\/$/,
  ''
);

export function remoteBackendUrl(): string {
  return REMOTE_BACKEND;
}

/** Bearer auth headers for backend calls. Set json=false to omit Content-Type (GET/no-body). */
export function authHeaders(token: string, json = true): Record<string, string> {
  return json
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { Authorization: `Bearer ${token}` };
}

export function backendUrl(path = ''): string {
  const raw = path ? (path.startsWith('/') ? path : `/${path}`) : '';

  // Normalize: ensure path starts with /api/v1
  let normalized: string;
  if (raw.startsWith('/api/v1')) {
    // Already /api/v1, keep as-is
    normalized = raw;
  } else if (raw.startsWith('/api/')) {
    // Has /api/ but not /api/v1, add v1
    normalized = raw.replace(/^\/api\//, '/api/v1/');
  } else if (raw.startsWith('/api')) {
    // Exactly /api, convert to /api/v1
    normalized = '/api/v1';
  } else if (raw === '') {
    // Empty path
    normalized = '/api/v1';
  } else {
    // No /api prefix, add /api/v1
    normalized = `/api/v1${raw}`;
  }

  if (typeof window !== 'undefined') {
    // Browser: always call the full API path (no proxy)
    // This handles both localhost (same origin) and production domains
    return normalized;
  }

  // Server-side: use remote backend with full normalized path
  return `${REMOTE_BACKEND}${normalized}`;
}
