import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/responseHelper';

/**
 * Health check endpoint
 */
export function ping(req: Request, res: Response): void {
  sendSuccess(res, { message: 'pong', timestamp: Date.now() });
}

export default { ping };
