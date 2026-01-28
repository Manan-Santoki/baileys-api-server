import type { Request, Response } from 'express';
import sessionManager from '../services/SessionManager';
import messageService from '../services/MessageService';
import logger from '../logger';
import { sendSuccess, sendError } from '../utils/responseHelper';
import { toBaileysJid, toWwebjsJid, createSerializedId, getPhoneNumber, isGroupJid } from '../utils/jidHelper';
import type { SendMessageOptions } from '../types';

/**
 * Send a message
 */
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, contentType, content, options } = req.body;

  if (!chatId || !contentType || content === undefined) {
    sendError(res, 'chatId, contentType, and content are required', 400, 'validation_error');
    return;
  }

  try {
    const messageOptions: SendMessageOptions = {
      chatId,
      contentType,
      content,
      options,
    };

    const message = await messageService.sendMessage(sessionId, messageOptions);

    if (message) {
      sendSuccess(res, { message });
    } else {
      sendError(res, 'Failed to send message', 500);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error sending message');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get all chats
 */
export async function getChats(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const chats = await sessionManager.getChats(sessionId);
    sendSuccess(res, { chats });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get chats';
    logger.error({ sessionId, error: errorMessage }, 'Error getting chats');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get chat by ID
 */
export async function getChatById(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    const chat = await sessionManager.getChatById(sessionId, chatId);

    if (chat) {
      sendSuccess(res, { chat });
    } else {
      sendError(res, 'Chat not found', 404, 'chat_not_found');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get chat';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error getting chat');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get all contacts
 */
export async function getContacts(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const contacts = await sessionManager.getContacts(sessionId);
    sendSuccess(res, { contacts });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get contacts';
    logger.error({ sessionId, error: errorMessage }, 'Error getting contacts');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get contact by ID
 */
export async function getContactById(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  try {
    const contact = await sessionManager.getContactById(sessionId, contactId);

    if (contact) {
      sendSuccess(res, { contact });
    } else {
      sendError(res, 'Contact not found', 404, 'contact_not_found');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get contact';
    logger.error({ sessionId, contactId, error: errorMessage }, 'Error getting contact');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Check if user is registered on WhatsApp
 */
export async function isRegisteredUser(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { contactId } = req.body;

  if (!contactId) {
    sendError(res, 'contactId is required', 400, 'validation_error');
    return;
  }

  try {
    const isRegistered = await sessionManager.isRegisteredUser(sessionId, contactId);
    sendSuccess(res, { isRegistered });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to check registration';
    logger.error({ sessionId, contactId, error: errorMessage }, 'Error checking registration');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get client info
 */
export function getInfo(req: Request, res: Response): void {
  const { sessionId } = req.params;

  const info = sessionManager.getClientInfo(sessionId);

  if (info) {
    sendSuccess(res, { info });
  } else {
    sendError(res, 'Client info not available', 404);
  }
}

/**
 * Get labels (business accounts)
 */
export async function getLabels(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  try {
    const labels = await sessionManager.getLabels(sessionId);
    sendSuccess(res, { labels });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get labels';
    logger.error({ sessionId, error: errorMessage }, 'Error getting labels');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Create a group
 */
export async function createGroup(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { name, participants } = req.body;

  if (!name || !participants || !Array.isArray(participants)) {
    sendError(res, 'name and participants array are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const participantJids = participants.map(toBaileysJid);
    const result = await session.socket.groupCreate(name, participantJids);

    sendSuccess(res, {
      group: {
        id: createSerializedId(result.id),
        name: result.subject,
        participants: result.participants.map((p: any) => ({
          id: createSerializedId(p.id),
          isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
          isSuperAdmin: p.admin === 'superadmin',
        })),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to create group';
    logger.error({ sessionId, name, error: errorMessage }, 'Error creating group');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get profile picture URL
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
 * Get blocked contacts
 */
export async function getBlockedContacts(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const blockedJids = await session.socket.fetchBlocklist();
    const contacts = blockedJids.map((jid) => ({
      id: createSerializedId(jid),
      number: getPhoneNumber(jid),
    }));

    sendSuccess(res, { blockedContacts: contacts });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get blocked contacts';
    logger.error({ sessionId, error: errorMessage }, 'Error getting blocked contacts');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Block a contact
 */
export async function blockContact(req: Request, res: Response): Promise<void> {
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
export async function unblockContact(req: Request, res: Response): Promise<void> {
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
 * Set status
 */
export async function setStatus(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { status } = req.body;

  if (!status) {
    sendError(res, 'status is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    await session.socket.updateProfileStatus(status);
    sendSuccess(res, { message: 'Status updated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set status';
    logger.error({ sessionId, error: errorMessage }, 'Error setting status');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Set display name
 */
export async function setDisplayName(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { displayName } = req.body;

  if (!displayName) {
    sendError(res, 'displayName is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    await session.socket.updateProfileName(displayName);
    sendSuccess(res, { message: 'Display name updated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set display name';
    logger.error({ sessionId, error: errorMessage }, 'Error setting display name');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get common groups
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
    // We would need to iterate through all groups and check membership
    logger.warn({ sessionId, contactId }, 'getCommonGroups not fully supported in Baileys');
    sendSuccess(res, { groups: [] });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get common groups';
    logger.error({ sessionId, contactId, error: errorMessage }, 'Error getting common groups');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get number ID (check if number is on WhatsApp and get JID)
 */
export async function getNumberId(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { number } = req.body;

  if (!number) {
    sendError(res, 'number is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const [result] = await session.socket.onWhatsApp(number);

    if (result?.exists) {
      sendSuccess(res, {
        numberId: {
          _serialized: toWwebjsJid(result.jid),
          user: getPhoneNumber(result.jid),
          server: 'c.us',
        },
      });
    } else {
      sendSuccess(res, { numberId: null });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get number ID';
    logger.error({ sessionId, number, error: errorMessage }, 'Error getting number ID');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Send presence update
 */
export async function sendPresenceUpdate(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { presence } = req.body;

  if (!presence) {
    sendError(res, 'presence is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    // Map wwebjs presence to Baileys presence
    const presenceMap: Record<string, any> = {
      available: 'available',
      unavailable: 'unavailable',
      composing: 'composing',
      recording: 'recording',
      paused: 'paused',
    };

    const baileysPresence = presenceMap[presence] || presence;
    await session.socket.sendPresenceUpdate(baileysPresence);
    sendSuccess(res, { message: 'Presence updated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send presence update';
    logger.error({ sessionId, presence, error: errorMessage }, 'Error sending presence update');
    sendError(res, errorMessage, 500);
  }
}

export default {
  sendMessage,
  getChats,
  getChatById,
  getContacts,
  getContactById,
  isRegisteredUser,
  getInfo,
  getLabels,
  createGroup,
  getProfilePicUrl,
  getBlockedContacts,
  blockContact,
  unblockContact,
  setStatus,
  setDisplayName,
  getCommonGroups,
  getNumberId,
  sendPresenceUpdate,
};
