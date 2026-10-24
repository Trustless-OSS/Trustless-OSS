'use client';

import { useEffect, useState } from 'react';

export type StellarNetwork = 'testnet' | 'mainnet';

export const NETWORKS: { value: StellarNetwork; label: string }[] = [
  { value: 'testnet', label: 'Testnet' },
  { value: 'mainnet', label: 'Mainnet' },
];

const STORAGE_KEY = 'toss-network';
const DEFAULT_NETWORK: StellarNetwork = 'testnet';

function isNetwork(value: unknown): value is StellarNetwork {
  return value === 'testnet' || value === 'mainnet';
}

/** Read the persisted network. Safe on the server (returns default). */
export function getNetwork(): StellarNetwork {
  if (typeof window === 'undefined') return DEFAULT_NETWORK;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isNetwork(stored) ? stored : DEFAULT_NETWORK;
}

/** React hook: current network + setter. Writes persist and sync across tabs. */
export function useNetwork(): [StellarNetwork, (n: StellarNetwork) => void] {
  const [network, setNetwork] = useState<StellarNetwork>(DEFAULT_NETWORK);

  useEffect(() => {
    setNetwork(getNetwork());
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && isNetwork(e.newValue)) setNetwork(e.newValue);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function update(next: StellarNetwork) {
    window.localStorage.setItem(STORAGE_KEY, next);
    setNetwork(next);
  }

  return [network, update];
}
