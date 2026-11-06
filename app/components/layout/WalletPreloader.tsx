'use client';

import { useEffect } from 'react';
import { preloadWalletKit } from '@/lib/wallet-kit';

export default function WalletPreloader() {
  useEffect(preloadWalletKit, []);

  return null;
}
