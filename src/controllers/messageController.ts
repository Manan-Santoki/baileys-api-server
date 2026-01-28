import type { Request, Response } from 'express';
import sessionManager from '../services/SessionManager';
import messageService from '../services/MessageService';
import logger from '../logger';
import { sendSuccess, sendError } from '../utils/responseHelper';
import { toBaileysJid, createMessageId } from '../utils/jidHelper';

/**
 * Get message info (delivery/read receipts)
 */
export async function getInfo(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, messageId } = req.body;

  if (!chatId || !messageId) {
    sendError(res, 'chatId and messageId are required', 400, 'validation_error');
    return;
  }

  // Note: Baileys doesn't have a direct way to get message info like wwebjs
  // This would require storing and tracking message receipts
  logger.warn({ sessionId, chatId, messageId }, 'getInfo not fully supported in Baileys');

  sendSuccess(res, {
    info: {
      delivery: [],
      read: [],
      played: [],
    },
  });
}

/**
 * React to a message
 */
export async function react(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, messageId, emoji } = req.body;

  if (!chatId || !messageId || emoji === undefined) {
    sendError(res, 'chatId, messageId, and emoji are required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.reactToMessage(sessionId, chatId, messageId, emoji);
    sendSuccess(res, { message: 'Reaction sent' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to react to message';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error reacting to message');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Star/unstar a message
 */
export async function star(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, messageId, star: shouldStar } = req.body;

  if (!chatId || !messageId || shouldStar === undefined) {
    sendError(res, 'chatId, messageId, and star are required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.starMessage(sessionId, chatId, messageId, shouldStar);
    sendSuccess(res, { message: shouldStar ? 'Message starred' : 'Message unstarred' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to star message';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error starring message');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Delete a message
 */
export async function deleteMessage(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, messageId, forEveryone } = req.body;

  if (!chatId || !messageId) {
    sendError(res, 'chatId and messageId are required', 400, 'validation_error');
    return;
  }

  try {
    await messageService.deleteMessage(sessionId, chatId, messageId, forEveryone || false);
    sendSuccess(res, { message: 'Message deleted' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete message';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error deleting message');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Forward a message
 */
export async function forward(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, messageId, targetChatId } = req.body;

  if (!chatId || !messageId || !targetChatId) {
    sendError(res, 'chatId, messageId, and targetChatId are required', 400, 'validation_error');
    return;
  }

  try {
    const message = await messageService.forwardMessage(sessionId, chatId, messageId, targetChatId);

    if (message) {
      sendSuccess(res, { message });
    } else {
      sendError(res, 'Failed to forward message', 500);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to forward message';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error forwarding message');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Download media from a message
 */
export async function downloadMedia(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { messageData } = req.body;

  if (!messageData) {
    sendError(res, 'messageData is required', 400, 'validation_error');
    return;
  }

  try {
    const media = await messageService.downloadMedia(sessionId, messageData);

    if (media) {
      sendSuccess(res, { media });
    } else {
      sendError(res, 'Failed to download media', 500);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to download media';
    logger.error({ sessionId, error: errorMessage }, 'Error downloading media');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get quoted message
 */
export async function getQuotedMessage(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, messageId } = req.body;

  if (!chatId || !messageId) {
    sendError(res, 'chatId and messageId are required', 400, 'validation_error');
    return;
  }

  // Note: Baileys doesn't have a direct way to get quoted messages
  // This would require storing messages
  logger.warn({ sessionId, chatId, messageId }, 'getQuotedMessage not fully supported in Baileys');
  sendSuccess(res, { quotedMessage: null });
}

/**
 * Get mentions from a message
 */
export async function getMentions(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { messageData } = req.body;

  if (!messageData) {
    sendError(res, 'messageData is required', 400, 'validation_error');
    return;
  }

  try {
    // Extract mentions from message data
    const mentions = messageData.mentionedIds || [];
    sendSuccess(res, { mentions });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get mentions';
    logger.error({ sessionId, error: errorMessage }, 'Error getting mentions');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Edit a message
 */
export async function edit(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, messageId, newContent } = req.body;

  if (!chatId || !messageId || !newContent) {
    sendError(res, 'chatId, messageId, and newContent are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(chatId);

    // Note: Message editing requires the original message key
    // This is a limitation without message storage
    await session.socket.sendMessage(jid, {
      edit: {
        remoteJid: jid,
        id: messageId,
        fromMe: true,
      },
      text: newContent,
    });

    sendSuccess(res, { message: 'Message edited' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to edit message';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error editing message');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Pin a message
 */
export async function pin(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, messageId, duration } = req.body;

  if (!chatId || !messageId) {
    sendError(res, 'chatId and messageId are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(chatId);

    await session.socket.sendMessage(jid, {
      pin: {
        type: 1, // PIN
        time: duration || 604800, // Default 7 days
      },
      key: {
        remoteJid: jid,
        id: messageId,
        fromMe: true,
      },
    } as any);

    sendSuccess(res, { message: 'Message pinned' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to pin message';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error pinning message');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Unpin a message
 */
export async function unpin(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { chatId, messageId } = req.body;

  if (!chatId || !messageId) {
    sendError(res, 'chatId and messageId are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(chatId);

    await session.socket.sendMessage(jid, {
      pin: {
        type: 2, // UNPIN
        time: 0,
      },
      key: {
        remoteJid: jid,
        id: messageId,
        fromMe: true,
      },
    } as any);

    sendSuccess(res, { message: 'Message unpinned' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to unpin message';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error unpinning message');
    sendError(res, errorMessage, 500);
  }
}

export default {
  getInfo,
  react,
  star,
  deleteMessage,
  forward,
  downloadMedia,
  getQuotedMessage,
  getMentions,
  edit,
  pin,
  unpin,
};
