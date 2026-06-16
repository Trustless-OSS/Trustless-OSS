import 'dotenv/config';
import http from 'http';
import { json, dispatch } from '../router';
import '../app';

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

  try {
    await dispatch(req, res);
  } catch (err) {
    console.error('[Server] Unhandled error:', err);
    if (!res.headersSent) {
      json(res, { error: 'Internal Server Error' }, 500);
    }
  }
}
