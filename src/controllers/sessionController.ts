import type { Request, Response } from 'express';
import QRCode from 'qrcode';
import sessionManager from '../services/SessionManager';
import logger from '../logger';
import { sendSuccess, sendError, sendSessionNotFound } from '../utils/responseHelper';

/**
 * Start a new session
 */
export async function startSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    await sessionManager.startSession(sessionId);
    sendSuccess(res, { message: 'Session started' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to start session';
    logger.error({ sessionId, error: errorMessage }, 'Error starting session');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Stop a session (keep auth)
 */
export async function stopSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  if (!sessionManager.hasSession(sessionId)) {
    sendSessionNotFound(res, sessionId);
    return;
  }

  try {
    await sessionManager.stopSession(sessionId);
    sendSuccess(res, { message: 'Session stopped' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to stop session';
    logger.error({ sessionId, error: errorMessage }, 'Error stopping session');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get session status
 */
export function getStatus(req: Request, res: Response): void {
  const { sessionId } = req.params;

  const status = sessionManager.getStatus(sessionId);

  if (status === null) {
    sendSuccess(res, { state: 'STOPPED' });
    return;
  }

  // Map internal status to wwebjs-compatible state
  const stateMap: Record<string, string> = {
    connecting: 'INITIALIZING',
    qr: 'QR_RECEIVED',
    pairing: 'PAIRING',
    connected: 'CONNECTED',
    disconnected: 'DISCONNECTED',
  };

  sendSuccess(res, { state: stateMap[status] || status.toUpperCase() });
}

/**
 * Terminate session (logout and delete auth)
 */
export async function terminateSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    await sessionManager.terminateSession(sessionId);
    sendSuccess(res, { message: 'Session terminated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to terminate session';
    logger.error({ sessionId, error: errorMessage }, 'Error terminating session');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get all sessions
 */
export function getSessions(req: Request, res: Response): void {
  const sessionIds = sessionManager.getAllSessionIds();

  const sessions = sessionIds.map((id) => ({
    sessionId: id,
    status: sessionManager.getStatus(id),
  }));

  sendSuccess(res, { sessions });
}

/**
 * Get QR code as text
 */
export function getQr(req: Request, res: Response): void {
  const { sessionId } = req.params;

  if (!sessionManager.hasSession(sessionId)) {
    sendSessionNotFound(res, sessionId);
    return;
  }

  const qr = sessionManager.getQr(sessionId);

  if (!qr) {
    sendError(res, 'QR code not available', 404, 'qr_not_available');
    return;
  }

  sendSuccess(res, { qr });
}

/**
 * Get QR code as image
 */
export async function getQrImage(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  if (!sessionManager.hasSession(sessionId)) {
    sendSessionNotFound(res, sessionId);
    return;
  }

  const qr = sessionManager.getQr(sessionId);

  if (!qr) {
    sendError(res, 'QR code not available', 404, 'qr_not_available');
    return;
  }

  try {
    const qrImage = await QRCode.toDataURL(qr, {
      type: 'image/png',
      width: 300,
      margin: 2,
    });

    // Return base64 image
    const base64Data = qrImage.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate QR image';
    logger.error({ sessionId, error: errorMessage }, 'Error generating QR image');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Request pairing code
 */
export async function requestPairingCode(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { phoneNumber } = req.body;

  if (!phoneNumber) {
    sendError(res, 'Phone number is required', 400, 'validation_error');
    return;
  }

  if (!sessionManager.hasSession(sessionId)) {
    // Start session first
    try {
      await sessionManager.startSession(sessionId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start session';
      logger.error({ sessionId, error: errorMessage }, 'Error starting session for pairing');
      sendError(res, errorMessage, 500);
      return;
    }
  }

  try {
    const code = await sessionManager.requestPairingCode(sessionId, phoneNumber);

    if (code) {
      sendSuccess(res, { pairingCode: code });
    } else {
      sendError(res, 'Failed to request pairing code', 500);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to request pairing code';
    logger.error({ sessionId, phoneNumber, error: errorMessage }, 'Error requesting pairing code');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Logout session
 */
export async function logoutSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  if (!sessionManager.hasSession(sessionId)) {
    sendSessionNotFound(res, sessionId);
    return;
  }

  try {
    await sessionManager.logoutSession(sessionId);
    sendSuccess(res, { message: 'Logged out successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to logout';
    logger.error({ sessionId, error: errorMessage }, 'Error logging out session');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Restart session
 */
export async function restartSession(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    if (sessionManager.hasSession(sessionId)) {
      await sessionManager.stopSession(sessionId);
    }
    await sessionManager.startSession(sessionId);
    sendSuccess(res, { message: 'Session restarted' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to restart session';
    logger.error({ sessionId, error: errorMessage }, 'Error restarting session');
    sendError(res, errorMessage, 500);
  }
}

export default {
  startSession,
  stopSession,
  getStatus,
  terminateSession,
  getSessions,
  getQr,
  getQrImage,
  requestPairingCode,
  logoutSession,
  restartSession,
};
