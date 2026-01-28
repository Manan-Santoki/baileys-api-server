import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import logger from '../logger';
import { sendError } from '../utils/responseHelper';

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error({
    error: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    body: req.body,
  }, 'Unhandled error');

  // Don't send error if headers already sent
  if (res.headersSent) {
    return next(err);
  }

  sendError(res, err.message || 'Internal server error', 500);
};

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  sendError(res, `Route not found: ${req.method} ${req.path}`, 404, 'not_found');
}

export default errorHandler;
