import { Keypair, TransactionBuilder, Networks, Transaction } from '@stellar/stellar-sdk';
import { twFetch } from '../trustless-work/client.js';
import { logger } from '../logger.js';

const log = logger.child({ module: 'stellar-signer' });

export async function signAndSendTransaction(
  unsignedXdr: string,
  secretOverride?: string
): Promise<unknown> {
  const secret = secretOverride || process.env.PLATFORM_STELLAR_SECRET_KEY!;
  const network = process.env.STELLAR_NETWORK === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;

  const keypair = Keypair.fromSecret(secret);

  const tx = TransactionBuilder.fromXDR(unsignedXdr, network) as Transaction;
  tx.sign(keypair);
  const signedXdr = tx.toEnvelope().toXDR('base64');

  const result = await twFetch('/helper/send-transaction', {
    method: 'POST',
    body: JSON.stringify({ signedXdr }),
  });

  log.info({ result }, 'transaction submitted');
  return result;
}
