const REMOTE_BACKEND = (process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5000').replace(
  /\/$/,
  ''
);

export function remoteBackendUrl(): string {
  return REMOTE_BACKEND;
}

export function backendUrl(path = ''): string {
  const raw = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  const normalized = raw === '/api' ? '/api/v1' : raw.startsWith('/api/v1') ? raw : raw.startsWith('/api/') ? raw.replace(/^\/api\//, '/api/v1/') : raw.startsWith('/api') ? '/api/v1' : `/api/v1${raw}`;

  if (typeof window !== 'undefined') {
    return `/api/backend${normalized}`;
  }
  return `${REMOTE_BACKEND}${normalized}`;
}
