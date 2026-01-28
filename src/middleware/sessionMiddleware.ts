import type { Request, Response, NextFunction } from 'express';
import sessionManager from '../services/SessionManager';
import { sendSessionNotFound, sendSessionNotConnected } from '../utils/responseHelper';

/**
 * Validate session exists
 */
export function sessionExistsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.params.sessionId;

  if (!sessionId) {
    sendSessionNotFound(res, 'undefined');
    return;
  }

  if (!sessionManager.hasSession(sessionId)) {
    sendSessionNotFound(res, sessionId);
    return;
  }

  next();
}

/**
 * Validate session exists and is connected
 */
export function sessionConnectedMiddleware(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.params.sessionId;

  if (!sessionId) {
    sendSessionNotFound(res, 'undefined');
    return;
  }

  if (!sessionManager.hasSession(sessionId)) {
    sendSessionNotFound(res, sessionId);
    return;
  }

  if (!sessionManager.isConnected(sessionId)) {
    sendSessionNotConnected(res, sessionId);
    return;
  }

  next();
}

export { sessionExistsMiddleware as sessionExists, sessionConnectedMiddleware as sessionConnected };
