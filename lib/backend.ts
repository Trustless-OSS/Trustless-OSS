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
  const normalized =
    raw === '/api'
      ? '/api/v1'
      : raw.startsWith('/api/v1')
        ? raw
        : raw.startsWith('/api/')
          ? raw.replace(/^\/api\//, '/api/v1/')
          : raw.startsWith('/api')
            ? '/api/v1'
            : `/api/v1${raw}`;

  if (typeof window !== 'undefined') {
    return `/api/backend${normalized}`;
  }
  return `${REMOTE_BACKEND}${normalized}`;
}
