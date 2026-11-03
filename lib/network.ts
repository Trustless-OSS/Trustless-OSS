// Shared (server + client) network helpers. No 'use client' so server code can import it.
export type StellarNetwork = 'testnet' | 'mainnet';

export const NETWORK_COOKIE = 'toss-network';
export const DEFAULT_NETWORK: StellarNetwork = 'testnet';

// Mainnet remains unavailable until the product is launched there.
export const MAINNET_ENABLED = false;

export const NETWORKS: { value: StellarNetwork; label: string; disabled: boolean }[] = [
  { value: 'testnet', label: 'Testnet', disabled: false },
  { value: 'mainnet', label: 'Mainnet · Coming soon', disabled: true },
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
  if (next !== 'testnet') return;
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
