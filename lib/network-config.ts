'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_NETWORK, getNetwork, switchNetwork, type StellarNetwork } from '@/lib/network';

export { NETWORKS, getNetwork, type StellarNetwork } from '@/lib/network';

/** React hook: current network + setter. Setting reloads the app on the new network. */
export function useNetwork(): [StellarNetwork, (n: StellarNetwork) => void] {
  const [network, setNetwork] = useState<StellarNetwork>(DEFAULT_NETWORK);

  useEffect(() => {
    setNetwork(getNetwork());
  }, []);

  return [network, switchNetwork];
}
