import type { Request, Response, NextFunction } from 'express';
import config from '../config';
import { sendError } from '../utils/responseHelper';

/**
 * Validate API key from x-api-key header
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'] as string;

  if (!config.apiKey) {
    // No API key configured, allow all requests
    next();
    return;
  }

  if (!apiKey) {
    sendError(res, 'API key is required', 401, 'unauthorized');
    return;
  }

  if (apiKey !== config.apiKey) {
    sendError(res, 'Invalid API key', 401, 'unauthorized');
    return;
  }

  next();
}

export default authMiddleware;
