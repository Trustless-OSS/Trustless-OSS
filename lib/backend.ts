import { getNetwork, type StellarNetwork } from '@/lib/network';

const trim = (url: string) => url.replace(/\/$/, '');

// One backend deployment per network (each has its own STELLAR_NETWORK, keys, DB, GitHub App).
const BACKEND_URLS: Record<StellarNetwork, string> = {
  testnet: trim(
    process.env.NEXT_PUBLIC_BACKEND_URL_TESTNET ??
      process.env.NEXT_PUBLIC_BACKEND_URL ??
      'http://localhost:5000'
  ),
  mainnet: trim(process.env.NEXT_PUBLIC_BACKEND_URL_MAINNET ?? ''),
};

/** Backend origin for a network. Server code must pass the network (see getServerNetwork). */
export function remoteBackendUrl(network: StellarNetwork = getNetwork()): string {
  return BACKEND_URLS[network];
}

/** Bearer auth headers for backend calls. Set json=false to omit Content-Type (GET/no-body). */
export function authHeaders(token: string, json = true): Record<string, string> {
  return json
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { Authorization: `Bearer ${token}` };
}

export function backendUrl(path = '', network: StellarNetwork = getNetwork()): string {
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

  return `${remoteBackendUrl(network)}${normalized}`;
}
