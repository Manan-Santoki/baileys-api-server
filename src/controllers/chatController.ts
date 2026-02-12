import type { Request, Response } from 'express';
import sessionManager from '../services/SessionManager';
import messageService from '../services/MessageService';
import logger from '../logger';
import { sendSuccess, sendError } from '../utils/responseHelper';
import { toBaileysJid } from '../utils/jidHelper';

/**
 * Fetch messages from a chat
 */
export async function fetchMessages(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, limit, before } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    const messages = await messageService.fetchMessages(sessionId, chatId, {
      limit: limit || 50,
      before,
    });

    sendSuccess(res, { messages });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch messages';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error fetching messages');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Send typing indicator
 */
export async function sendStateTyping(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.sendTyping(sessionId, chatId, true);
    sendSuccess(res, { message: 'Typing indicator sent' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send typing indicator';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error sending typing indicator');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Clear typing indicator
 */
export async function clearState(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.sendTyping(sessionId, chatId, false);
    sendSuccess(res, { message: 'State cleared' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to clear state';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error clearing state');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Send recording indicator
 */
export async function sendStateRecording(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.sendRecording(sessionId, chatId, true);
    sendSuccess(res, { message: 'Recording indicator sent' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to send recording indicator';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error sending recording indicator');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Mark chat as read
 */
export async function sendSeen(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.markChatRead(sessionId, chatId);
    sendSuccess(res, { message: 'Chat marked as read' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to mark chat as read';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error marking chat as read');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Mark chat as unread
 */
export async function markUnread(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.markChatUnread(sessionId, chatId);
    sendSuccess(res, { message: 'Chat marked as unread' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to mark chat as unread';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error marking chat as unread');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Archive a chat
 */
export async function archive(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.archiveChat(sessionId, chatId);
    sendSuccess(res, { message: 'Chat archived' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to archive chat';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error archiving chat');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Unarchive a chat
 */
export async function unarchive(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.unarchiveChat(sessionId, chatId);
    sendSuccess(res, { message: 'Chat unarchived' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to unarchive chat';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error unarchiving chat');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Pin a chat
 */
export async function pin(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.pinChat(sessionId, chatId);
    sendSuccess(res, { message: 'Chat pinned' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to pin chat';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error pinning chat');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Unpin a chat
 */
export async function unpin(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.unpinChat(sessionId, chatId);
    sendSuccess(res, { message: 'Chat unpinned' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to unpin chat';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error unpinning chat');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Mute a chat
 */
export async function mute(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, duration } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.muteChat(sessionId, chatId, duration);
    sendSuccess(res, { message: 'Chat muted' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to mute chat';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error muting chat');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Unmute a chat
 */
export async function unmute(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.unmuteChat(sessionId, chatId);
    sendSuccess(res, { message: 'Chat unmuted' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to unmute chat';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error unmuting chat');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Clear chat messages
 */
export async function clearMessages(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.clearChat(sessionId, chatId);
    sendSuccess(res, { message: 'Chat cleared' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to clear chat';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error clearing chat');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Delete a chat
 */
export async function deleteChat(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.deleteChat(sessionId, chatId);
    sendSuccess(res, { message: 'Chat deleted' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete chat';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error deleting chat');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get chat labels
 */
export async function getLabels(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      sendError(res, 'Session not connected', 400, 'session_not_connected');
      return;
    }

    const jid = toBaileysJid(chatId);
    const labelLinks = session.store.getChatLabels(jid);
    const labels = labelLinks
      .map((association) => {
        const labelId = String((association as { labelId?: string }).labelId || '');
        return session.store.getLabels().findById(labelId);
      })
      .filter(Boolean);

    sendSuccess(res, { labels });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get chat labels';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error getting chat labels');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get contact info for chat
 */
export async function getContact(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId } = req.body;

  if (!chatId) {
    sendError(res, 'chatId is required', 400, 'validation_error');
    return;
  }

  try {
    const contact = await sessionManager.getContactById(sessionId, chatId);

    if (contact) {
      sendSuccess(res, { contact });
    } else {
      sendError(res, 'Contact not found', 404, 'contact_not_found');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get contact';
    logger.error({ sessionId, chatId, error: errorMessage }, 'Error getting contact');
    sendError(res, errorMessage, 500);
  }
}

export default {
  fetchMessages,
  sendStateTyping,
  clearState,
  sendStateRecording,
  sendSeen,
  markUnread,
  archive,
  unarchive,
  pin,
  unpin,
  mute,
  unmute,
  clearMessages,
  deleteChat,
  getLabels,
  getContact,
};
