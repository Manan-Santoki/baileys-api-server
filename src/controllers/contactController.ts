import type { Request, Response } from 'express';
import sessionManager from '../services/SessionManager';
import logger from '../logger';
import { sendSuccess, sendError } from '../utils/responseHelper';
import { toBaileysJid, toWwebjsJid, createSerializedId, getPhoneNumber } from '../utils/jidHelper';

/**
 * Get contact "about" (status)
 */
export async function getAbout(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(contactId);
    const status = await session.socket.fetchStatus(jid);

    sendSuccess(res, {
      about: status?.status || null,
      setAt: status?.setAt ? new Date(status.setAt * 1000).toISOString() : null,
    });
  } catch (error) {
    // Status might not be available
    sendSuccess(res, { about: null, setAt: null });
  }
}

/**
 * Get contact profile picture URL
 */
export async function getProfilePicUrl(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(contactId);
    const url = await session.socket.profilePictureUrl(jid, 'image');
    sendSuccess(res, { profilePicUrl: url });
  } catch (error) {
    // Profile picture might not be available
    sendSuccess(res, { profilePicUrl: null });
  }
}

/**
 * Block a contact
 */
export async function block(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(contactId);
    await session.socket.updateBlockStatus(jid, 'block');
    sendSuccess(res, { message: 'Contact blocked' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to block contact';
    logger.error({ sessionId, contactId, error: errorMessage }, 'Error blocking contact');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Unblock a contact
 */
export async function unblock(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(contactId);
    await session.socket.updateBlockStatus(jid, 'unblock');
    sendSuccess(res, { message: 'Contact unblocked' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to unblock contact';
    logger.error({ sessionId, contactId, error: errorMessage }, 'Error unblocking contact');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Check if contact is blocked
 */
export async function isBlocked(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(contactId);
    const blocklist = await session.socket.fetchBlocklist();
    const blocked = blocklist.includes(jid);

    sendSuccess(res, { isBlocked: blocked });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check block status';
    logger.error({ sessionId, contactId, error: errorMessage }, 'Error checking block status');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get common groups with contact
 */
export async function getCommonGroups(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    // Note: Baileys doesn't have a direct "get common groups" function
    logger.warn({ sessionId, contactId }, 'getCommonGroups not fully supported in Baileys');
    sendSuccess(res, { groups: [] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get common groups';
    logger.error({ sessionId, contactId, error: errorMessage }, 'Error getting common groups');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get formatted number
 */
export async function getFormattedNumber(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  try {
    const phoneNumber = getPhoneNumber(toBaileysJid(contactId));
    // Format with + prefix
    const formattedNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    sendSuccess(res, { formattedNumber });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get formatted number';
    logger.error({ sessionId, contactId, error: errorMessage }, 'Error getting formatted number');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get country code
 */
export async function getCountryCode(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  try {
    const phoneNumber = getPhoneNumber(toBaileysJid(contactId));

    // Extract country code (this is a simplified version)
    // A proper implementation would use a phone number library
    let countryCode = '';
    if (phoneNumber.startsWith('1')) {
      countryCode = '1'; // US/Canada
    } else if (phoneNumber.startsWith('44')) {
      countryCode = '44'; // UK
    } else if (phoneNumber.startsWith('91')) {
      countryCode = '91'; // India
    } else {
      // Try to get first 1-3 digits as country code
      countryCode = phoneNumber.substring(0, 2);
    }

    sendSuccess(res, { countryCode });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get country code';
    logger.error({ sessionId, contactId, error: errorMessage }, 'Error getting country code');
    sendError(res, errorMessage, 500);
  }
}

export default {
  getAbout,
  getProfilePicUrl,
  block,
  unblock,
  isBlocked,
  getCommonGroups,
  getFormattedNumber,
  getCountryCode,
};
