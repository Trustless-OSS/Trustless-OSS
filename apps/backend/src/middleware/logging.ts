import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';
import { logger } from '../lib/logger.js';

export function attachRequestContext(req: IncomingMessage, res: ServerResponse): void {
  (req as IncomingMessage & { id: string }).id = randomUUID();
  res.setHeader('x-request-id', (req as IncomingMessage & { id: string }).id);
  logger.info(
    {
      reqId: (req as IncomingMessage & { id: string }).id,
      method: req.method,
      url: req.url,
    },
    'incoming request'
  );
}

export function requestLogger(req: IncomingMessage) {
  return logger.child({
    reqId: (req as IncomingMessage & { id: string }).id,
  });
}
