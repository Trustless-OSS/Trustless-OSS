const BASE_URL = process.env.TRUSTLESS_WORK_BASE_URL ?? 'https://dev.api.trustlesswork.com';
const API_KEY = process.env.TRUSTLESS_WORK_API_KEY!;

export async function twFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      ...(options.headers as Record<string, string> ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`[TrustlessWork] ${options.method ?? 'GET'} ${path} → ${response.status}: ${text}`);
  }

  return response.json();
}
