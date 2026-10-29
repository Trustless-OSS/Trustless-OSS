import { cookies } from 'next/headers';
import { NETWORK_COOKIE, parseNetwork, type StellarNetwork } from '@/lib/network';

/** Selected network for Server Components / Route Handlers (read from the request cookie). */
export async function getServerNetwork(): Promise<StellarNetwork> {
  return parseNetwork((await cookies()).get(NETWORK_COOKIE)?.value);
}
