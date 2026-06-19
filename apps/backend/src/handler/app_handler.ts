import 'dotenv/config';
import http from 'http';
import { json, dispatch } from '../router';
import '../app';
import { logger } from '../lib/logger.js';
import { attachRequestContext } from '../middleware/logging.js';
import { trackHttpRequest } from '../lib/monitoring.js';

const log = logger.child({ module: 'app' });

const ALLOWED_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:3000';

export default async function appHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  attachRequestContext(req, res);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const method = req.method || 'GET';
    const status = res.statusCode;
    const route = (req as any).routePattern || 'unknown';
    trackHttpRequest(method, route, status, duration);
  });

  try {
    await dispatch(req, res);
  } catch (err) {
    log.error({ err }, 'unhandled error');
    if (!res.headersSent) {
      json(res, { error: 'Internal Server Error' }, 500);
    }
  }
}
