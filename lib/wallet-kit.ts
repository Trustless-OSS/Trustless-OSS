type WalletKit = typeof import('@creit.tech/stellar-wallets-kit').StellarWalletsKit;

let walletKitPromise: Promise<WalletKit> | null = null;

export const WALLET_OPERATION_TIMEOUT_MS = 120000;

export async function getWalletKit(): Promise<WalletKit> {
  if (!walletKitPromise) {
    walletKitPromise = loadWalletKit();
  }

  return walletKitPromise;
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

async function loadWalletKit(): Promise<WalletKit> {
  if (typeof window === 'undefined') {
    throw new Error('Stellar Wallets Kit can only be initialized in the browser.');
  }

  // Register only real Stellar wallets. defaultModules() includes a MetaMask
  // (Ethereum) module that throws "Failed to connect to MetaMask" when picked.
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
    network: Networks.TESTNET,
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
