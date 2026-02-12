import { proto } from '@whiskeysockets/baileys';
import type { Request, Response } from 'express';

import sessionManager from '../services/SessionManager';
import messageService from '../services/MessageService';
import logger from '../logger';
import { sendSuccess, sendError } from '../utils/responseHelper';
import { toBaileysJid, toWwebjsJid } from '../utils/jidHelper';

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

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const key = await sessionManager.resolveMessageKey(sessionId, chatId, messageId);
    const receipts = (await session.store.fetchMessageReceipts(key).catch(() => [])) || [];

    const delivery = receipts
      .filter((item) => !!item.receiptTimestamp)
      .map((item) => ({
        id: toWwebjsJid(item.userJid),
        timestamp: toTimestamp(item.receiptTimestamp),
      }));

    const read = receipts
      .filter((item) => !!item.readTimestamp)
      .map((item) => ({
        id: toWwebjsJid(item.userJid),
        timestamp: toTimestamp(item.readTimestamp),
      }));

    const played = receipts
      .filter((item) => !!item.playedTimestamp)
      .map((item) => ({
        id: toWwebjsJid(item.userJid),
        timestamp: toTimestamp(item.playedTimestamp),
      }));

    sendSuccess(res, {
      info: {
        delivery,
        read,
        played,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get message info';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error getting message info');
    sendError(res, errorMessage, 500);
  }
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
  const { messageData, chatId, messageId } = req.body;

  if (!messageData && (!chatId || !messageId)) {
    sendError(res, 'Provide either messageData OR chatId + messageId', 400, 'validation_error');
    return;
  }

  try {
    const media = messageData
      ? await messageService.downloadMedia(sessionId, messageData)
      : await messageService.downloadMediaById(sessionId, chatId, messageId);

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

  try {
    const message = await sessionManager.getMessageById(sessionId, chatId, messageId);

    if (!message?.message) {
      sendSuccess(res, { quotedMessage: null });
      return;
    }

    const contextInfo =
      message.message.extendedTextMessage?.contextInfo ||
      message.message.imageMessage?.contextInfo ||
      message.message.videoMessage?.contextInfo ||
      message.message.documentMessage?.contextInfo ||
      message.message.audioMessage?.contextInfo ||
      message.message.buttonsMessage?.contextInfo ||
      message.message.listMessage?.contextInfo;

    if (!contextInfo?.stanzaId || !contextInfo.quotedMessage) {
      sendSuccess(res, { quotedMessage: null });
      return;
    }

    const quotedFromStore = await sessionManager.getMessageById(sessionId, chatId, contextInfo.stanzaId);

    const quotedMessage =
      quotedFromStore ||
      ({
        key: {
          id: contextInfo.stanzaId,
          remoteJid: toBaileysJid(chatId),
          participant: contextInfo.participant || undefined,
          fromMe: false,
        },
        message: contextInfo.quotedMessage,
        messageTimestamp: message.messageTimestamp,
      } as proto.IWebMessageInfo);

    sendSuccess(res, {
      quotedMessage: sessionManager.formatMessage(quotedMessage, sessionId),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get quoted message';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error getting quoted message');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get mentions from a message
 */
export async function getMentions(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { messageData, chatId, messageId } = req.body;

  if (!messageData && (!chatId || !messageId)) {
    sendError(res, 'Provide either messageData OR chatId + messageId', 400, 'validation_error');
    return;
  }

  try {
    let mentions: string[] = messageData?.mentionedIds || [];

    if (!messageData) {
      const storedMessage = await sessionManager.getMessageById(sessionId, chatId, messageId);
      mentions = storedMessage ? sessionManager.formatMessage(storedMessage, sessionId).mentionedIds : [];
    }

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
    const key = await sessionManager.resolveMessageKey(sessionId, chatId, messageId);
    await session.socket.sendMessage(key.remoteJid || toBaileysJid(chatId), {
      text: newContent,
      edit: key,
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
    const key = await sessionManager.resolveMessageKey(sessionId, chatId, messageId);
    const chatJid = key.remoteJid || toBaileysJid(chatId);

    await session.socket.sendMessage(chatJid, {
      pin: key,
      type: proto.PinInChat.Type.PIN_FOR_ALL,
      time: normalizePinDuration(duration),
    });

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
    const key = await sessionManager.resolveMessageKey(sessionId, chatId, messageId);
    const chatJid = key.remoteJid || toBaileysJid(chatId);

    await session.socket.sendMessage(chatJid, {
      pin: key,
      type: proto.PinInChat.Type.UNPIN_FOR_ALL,
    });

    sendSuccess(res, { message: 'Message unpinned' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to unpin message';
    logger.error({ sessionId, chatId, messageId, error: errorMessage }, 'Error unpinning message');
    sendError(res, errorMessage, 500);
  }
}

function normalizePinDuration(value: unknown): 86400 | 604800 | 2592000 {
  const parsed = Number(value);
  if (parsed === 86400 || parsed === 604800 || parsed === 2592000) {
    return parsed;
  }

  if (parsed > 604800) {
    return 2592000;
  }

  if (parsed > 86400) {
    return 604800;
  }

  return 86400;
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'bigint') {
    return Number(value);
  }

  if (!value || typeof value !== 'object') {
    return 0;
  }

  if ('toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }

  if ('low' in value && typeof (value as { low: number }).low === 'number') {
    return (value as { low: number }).low;
  }

  return 0;
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
