import { getNetwork } from '@/lib/network-config';

type WalletKit = typeof import('@creit.tech/stellar-wallets-kit').StellarWalletsKit;

let walletKitPromise: Promise<WalletKit> | null = null;
let walletKitNetwork: string | null = null;

export const WALLET_OPERATION_TIMEOUT_MS = 120000;

/** Reuse the wallet selected in Profile or another app flow when available. */
export async function getActiveWalletAddress(): Promise<string> {
  const kit = await getWalletKit();
  try {
    const { address } = await kit.getAddress();
    if (address) return address;
  } catch {
    // No selected wallet in this browser yet.
  }
  const { address } = await withTimeout(
    kit.authModal(),
    WALLET_OPERATION_TIMEOUT_MS,
    'Wallet authorization timed out. Close the wallet modal and try again.'
  );
  if (!address) throw new Error('No Stellar public key returned');
  return address;
}

export async function getWalletKit(): Promise<WalletKit> {
  const network = getNetwork();

  if (!walletKitPromise || walletKitNetwork !== network) {
    walletKitNetwork = network;
    const pending = loadWalletKit(network);
    walletKitPromise = pending;
    void pending.catch(() => {
      if (walletKitPromise === pending) {
        walletKitPromise = null;
        walletKitNetwork = null;
      }
    });
  }

  return walletKitPromise;
}

export function preloadWalletKit(): void {
  if (typeof window === 'undefined') return;
  void getWalletKit().catch(() => undefined);
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  let timeoutId: number | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = window.setTimeout(() => reject(new Error(errorMessage)), ms);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function loadWalletKit(network: string): Promise<WalletKit> {
  if (typeof window === 'undefined') {
    throw new Error('Stellar Wallets Kit can only be initialized in the browser.');
  }

  // Exclude the incompatible MetaMask adapter included by defaultModules().
  const [
    { StellarWalletsKit, Networks },
    { FreighterModule },
    { xBullModule },
    { AlbedoModule },
    { LobstrModule },
    { RabetModule },
  ] = await Promise.all([
    import('@creit.tech/stellar-wallets-kit'),
    import('@creit.tech/stellar-wallets-kit/modules/freighter'),
    import('@creit.tech/stellar-wallets-kit/modules/xbull'),
    import('@creit.tech/stellar-wallets-kit/modules/albedo'),
    import('@creit.tech/stellar-wallets-kit/modules/lobstr'),
    import('@creit.tech/stellar-wallets-kit/modules/rabet'),
  ]);

  StellarWalletsKit.init({
    network: network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET,
    modules: [
      new FreighterModule(),
      new xBullModule(),
      new AlbedoModule(),
      new LobstrModule(),
      new RabetModule(),
    ],
  });

  return StellarWalletsKit;
}
