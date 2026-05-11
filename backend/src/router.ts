import type { IncomingMessage, ServerResponse } from 'http';

export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  params: Record<string, string>
) => Promise<void>;

interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: Handler;
}

const routes: Route[] = [];

function pathToRegex(path: string): { pattern: RegExp; paramNames: string[] } {
  const paramNames: string[] = [];
  const regexStr = path.replace(/:([^/]+)/g, (_, name: string) => {
    paramNames.push(name);
    return '([^/]+)';
  });
  return { pattern: new RegExp(`^${regexStr}$`), paramNames };
}

export function addRoute(method: string, path: string, handler: Handler): void {
  const { pattern, paramNames } = pathToRegex(path);
  routes.push({ method: method.toUpperCase(), pattern, paramNames, handler });
}

export async function dispatch(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase() ?? 'GET';

  for (const route of routes) {
    if (route.method !== method) continue;
    const match = (pathname ?? '/').match(route.pattern);
    if (!match) continue;

    const params: Record<string, string> = {};
    route.paramNames.forEach((name, i) => {
      params[name] = match[i + 1]!;
    });

    await route.handler(req, res, params);
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
}

/* ------------------------------------------------------------------ */
/* Helpers available to route handlers                                  */
/* ------------------------------------------------------------------ */

export function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function requireAuth(
  handler: Handler
): Handler {
  return async (req, res, params) => {
    const auth = req.headers.authorization;
    // Supabase JWT validation — extract user from Bearer token
    if (!auth?.startsWith('Bearer ')) {
      json(res, { error: 'Unauthorized' }, 401);
      return;
    }
    // Token is validated inside individual routes using supabase.auth.getUser(token)
    await handler(req, res, params);
  };
}
