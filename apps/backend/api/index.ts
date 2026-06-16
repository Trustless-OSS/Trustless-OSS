import appHandler from '../src/handler/app_handler';
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await appHandler(req, res);
}
