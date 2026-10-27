import { Horizon, Operation, TransactionBuilder, Asset } from '@stellar/stellar-sdk';
import { getNetwork } from '@/lib/network-config';

// USDC issuers by network
const USDC_ISSUERS = {
  mainnet: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  testnet: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
} as const;

// Horizon servers
const HORIZON_URLS = {
  mainnet: 'https://horizon.stellar.org',
  testnet: 'https://horizon-testnet.stellar.org',
} as const;

function getUsdcIssuer(): string {
  const network = getNetwork();
  return USDC_ISSUERS[network];
}

function getHorizonServer(): Horizon.Server {
  const network = getNetwork();
  return new Horizon.Server(HORIZON_URLS[network]);
}

export interface UsdcBalance {
  hasTrustline: boolean;
  balance: number | null;
}

/** Fetch account from Horizon and check USDC trustline status + balance. */
export async function checkUsdcTrustline(publicKey: string): Promise<UsdcBalance> {
  try {
    const server = getHorizonServer();
    const account = await server.loadAccount(publicKey);
    const usdc = USDC_ISSUERS[getNetwork()];

    // Check for USDC trustline (can be credit_alphanum4 or credit_alphanum12)
    const usdcBalance = account.balances.find((b) => {
      const balance = b as unknown as Record<string, unknown>;
      return (
        (b.asset_type === 'credit_alphanum4' || b.asset_type === 'credit_alphanum12') &&
        balance.asset_issuer === usdc &&
        balance.asset_code === 'USDC'
      );
    });

    if (!usdcBalance) {
      return { hasTrustline: false, balance: null };
    }

    return { hasTrustline: true, balance: parseFloat(usdcBalance.balance) };
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Failed to check USDC trustline', {
      cause: error,
    });
  }
}

/** Build an unsigned changeTrust transaction to enable USDC trustline. */
export async function buildEnableUsdcTx(publicKey: string): Promise<string> {
  try {
    const server = getHorizonServer();
    const account = await server.loadAccount(publicKey);
    const usdc = getUsdcIssuer();
    const network = getNetwork();

    const networkPassphrase =
      network === 'mainnet'
        ? 'Public Global Stellar Network ; September 2015'
        : 'Test SDF Network ; September 2015';

    const tx = new TransactionBuilder(account, {
      fee: '100',
      networkPassphrase,
    })
      .addOperation(
        Operation.changeTrust({
          asset: new Asset('USDC', usdc),
          limit: '922337203685.4775807', // max USDC
        })
      )
      .setTimeout(300)
      .build();

    return tx.toXDR();
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to build enable USDC transaction',
      { cause: error }
    );
  }
}

/** Submit a signed changeTrust transaction to Horizon. */
export async function submitEnableUsdcTx(signedXdr: string): Promise<string> {
  try {
    const server = getHorizonServer();
    const tx = new (await import('@stellar/stellar-sdk')).Transaction(signedXdr, 'any');
    const result = await server.submitTransaction(tx);
    // Try multiple possible response field names
    const resultAny = result as unknown as Record<string, unknown>;
    const txId =
      resultAny.hash ||
      resultAny.id ||
      (resultAny.transaction as unknown as Record<string, unknown>)?.id ||
      '';
    if (!txId) throw new Error('No transaction ID in response');
    return String(txId);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : 'Failed to submit enable USDC transaction',
      { cause: error }
    );
  }
}

/** Format USDC balance for display. */
export function formatUsdc(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
