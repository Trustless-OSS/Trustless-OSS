import {
  StellarWalletsKit,
  Networks,
} from '@creit.tech/stellar-wallets-kit';
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";

let initialized = false;

export function getWalletKit(): typeof StellarWalletsKit {
  if (!initialized && typeof window !== 'undefined') {
    StellarWalletsKit.init({
      network: Networks.TESTNET,
      modules: defaultModules(),
    });
    initialized = true;
  }
  return StellarWalletsKit;
}
