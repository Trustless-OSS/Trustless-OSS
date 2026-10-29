// Shared (server + client) network helpers. No 'use client' so server code can import it.
export type StellarNetwork = 'testnet' | 'mainnet';

export const NETWORK_COOKIE = 'toss-network';
export const DEFAULT_NETWORK: StellarNetwork = 'testnet';

// Mainnet is only selectable when a mainnet backend is configured, so the UI never
// pairs a mainnet wallet with a testnet backend.
export const MAINNET_ENABLED = Boolean(process.env.NEXT_PUBLIC_BACKEND_URL_MAINNET);

export const NETWORKS: { value: StellarNetwork; label: string }[] = [
  { value: 'testnet', label: 'Testnet' },
  ...(MAINNET_ENABLED ? [{ value: 'mainnet' as const, label: 'Mainnet' }] : []),
];

export function parseNetwork(value: unknown): StellarNetwork {
  return value === 'mainnet' && MAINNET_ENABLED ? 'mainnet' : DEFAULT_NETWORK;
}

/** Network from the cookie in the browser; the default on the server (use getServerNetwork there). */
export function getNetwork(): StellarNetwork {
  if (typeof document === 'undefined') return DEFAULT_NETWORK;
  const match = document.cookie.match(new RegExp(`(?:^|; )${NETWORK_COOKIE}=([^;]*)`));
  return parseNetwork(match?.[1]);
}

/** Persist the network and reload so every server/client fetch, wallet and Horizon switch together. */
export function switchNetwork(next: StellarNetwork) {
  if (next === getNetwork()) return;
  document.cookie = `${NETWORK_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
  window.location.reload();
}

export function stellarExpertNetwork(network: StellarNetwork = getNetwork()) {
  return network === 'mainnet' ? 'public' : 'testnet';
}

export function githubAppSlug(network: StellarNetwork = getNetwork()): string {
  return (
    (network === 'mainnet'
      ? process.env.NEXT_PUBLIC_GITHUB_APP_SLUG_MAINNET
      : process.env.NEXT_PUBLIC_GITHUB_APP_SLUG) || ''
  );
}
