import 'dotenv/config';
import http from 'http';
import { json, dispatch } from '../router';
import '../app';
import { logger } from '../lib/logger.js';
import { attachRequestContext } from '../middleware/logging.js';
import { isShuttingDown, trackActiveRequest, untrackActiveRequest } from '../lib/lifecycle.js';

const log = logger.child({ module: 'app' });

const ALLOWED_ORIGIN = process.env.FRONTEND_URL ?? 'http://localhost:3000';

export default async function appHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  if (isShuttingDown()) {
    json(res, { error: 'Service Unavailable', status: 'shutting_down' }, 503);
    return;
  }

  trackActiveRequest();
  const release = () => untrackActiveRequest();
  res.once('finish', release);
  res.once('close', release);

  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  attachRequestContext(req, res);

  try {
    await dispatch(req, res);
  } catch (err) {
    log.error({ err }, 'unhandled error');
    if (!res.headersSent) {
      json(res, { error: 'Internal Server Error' }, 500);
    }
  }
}
