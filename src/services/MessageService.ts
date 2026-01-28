import { proto, downloadMediaMessage, getContentType } from '@whiskeysockets/baileys';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { getLinkPreview } from 'link-preview-js';

import sessionManager from './SessionManager';
import logger from '../logger';
import { toBaileysJid, toWwebjsJid, createMessageId, createSerializedId } from '../utils/jidHelper';
import type {
  SendMessageOptions,
  MediaContent,
  LocationContent,
  PollContent,
  ContactContent,
  ButtonsContent,
  ListContent,
  MessageData,
} from '../types';

class MessageService {
  /**
   * Send a message
   */
  async sendMessage(sessionId: string, options: SendMessageOptions): Promise<MessageData | null> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(options.chatId);
    let result: proto.WebMessageInfo | undefined;

    try {
      switch (options.contentType) {
        case 'string':
          result = await this.sendTextMessage(session.socket, jid, options.content as string, options.options);
          break;

        case 'MessageMedia':
          result = await this.sendMediaMessage(session.socket, jid, options.content as MediaContent, options.options);
          break;

        case 'MessageMediaFromURL':
          result = await this.sendMediaFromUrl(session.socket, jid, options.content as string, options.options);
          break;

        case 'Location':
          result = await this.sendLocationMessage(session.socket, jid, options.content as LocationContent);
          break;

        case 'Poll':
          result = await this.sendPollMessage(session.socket, jid, options.content as PollContent);
          break;

        case 'Contact':
          result = await this.sendContactMessage(session.socket, jid, options.content as ContactContent);
          break;

        case 'Buttons':
          result = await this.sendButtonsMessage(session.socket, jid, options.content as ButtonsContent);
          break;

        case 'List':
          result = await this.sendListMessage(session.socket, jid, options.content as ListContent);
          break;

        default:
          throw new Error(`Unsupported content type: ${options.contentType}`);
      }

      if (result) {
        return sessionManager.formatMessage(result);
      }

      return null;
    } catch (error) {
      logger.error({ sessionId, chatId: options.chatId, error }, 'Error sending message');
      throw error;
    }
  }

  /**
   * Send text message
   */
  private async sendTextMessage(
    socket: any,
    jid: string,
    text: string,
    options?: SendMessageOptions['options']
  ): Promise<proto.WebMessageInfo | undefined> {
    const messageOptions: any = {
      text,
    };

    // Handle quoted message
    if (options?.quotedMessageId) {
      messageOptions.quoted = await this.getQuotedMessage(socket, jid, options.quotedMessageId);
    }

    // Handle mentions
    if (options?.mentions?.length) {
      messageOptions.mentions = options.mentions.map(toBaileysJid);
    }

    // Handle link preview
    if (options?.linkPreview !== false) {
      try {
        const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          const preview = await getLinkPreview(urlMatch[0], {
            timeout: 5000,
            followRedirects: 'follow',
          });

          if ('title' in preview) {
            messageOptions.linkPreview = {
              title: preview.title || '',
              description: preview.description || '',
              canonicalUrl: preview.url || urlMatch[0],
              matchedText: urlMatch[0],
            };
          }
        }
      } catch (error) {
        // Link preview failed, continue without it
        logger.debug({ error }, 'Link preview failed');
      }
    }

    return socket.sendMessage(jid, messageOptions);
  }

  /**
   * Send media message (image, video, audio, document)
   */
  private async sendMediaMessage(
    socket: any,
    jid: string,
    media: MediaContent,
    options?: SendMessageOptions['options']
  ): Promise<proto.WebMessageInfo | undefined> {
    const buffer = Buffer.from(media.data, 'base64');
    const mimetype = media.mimetype;

    const messageOptions: any = {};

    // Handle quoted message
    if (options?.quotedMessageId) {
      messageOptions.quoted = await this.getQuotedMessage(socket, jid, options.quotedMessageId);
    }

    // Handle mentions
    if (options?.mentions?.length) {
      messageOptions.mentions = options.mentions.map(toBaileysJid);
    }

    // Determine message type based on mimetype
    if (mimetype.startsWith('image/')) {
      return socket.sendMessage(jid, {
        image: buffer,
        caption: options?.caption || media.filename || '',
        mimetype,
        ...messageOptions,
      });
    } else if (mimetype.startsWith('video/')) {
      return socket.sendMessage(jid, {
        video: buffer,
        caption: options?.caption || media.filename || '',
        mimetype,
        gifPlayback: options?.sendVideoAsGif || false,
        ...messageOptions,
      });
    } else if (mimetype.startsWith('audio/')) {
      return socket.sendMessage(jid, {
        audio: buffer,
        mimetype,
        ptt: options?.sendAudioAsVoice || false,
        ...messageOptions,
      });
    } else {
      // Document
      return socket.sendMessage(jid, {
        document: buffer,
        fileName: media.filename || 'file',
        mimetype,
        ...messageOptions,
      });
    }
  }

  /**
   * Send media from URL
   */
  private async sendMediaFromUrl(
    socket: any,
    jid: string,
    url: string,
    options?: SendMessageOptions['options']
  ): Promise<proto.WebMessageInfo | undefined> {
    try {
      // Download the file
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'application/octet-stream';

      // Extract filename from URL or content-disposition
      let filename = 'file';
      const urlPath = new URL(url).pathname;
      const urlFilename = path.basename(urlPath);
      if (urlFilename && urlFilename.includes('.')) {
        filename = urlFilename;
      }

      const media: MediaContent = {
        mimetype: contentType,
        data: buffer.toString('base64'),
        filename,
      };

      return this.sendMediaMessage(socket, jid, media, options);
    } catch (error) {
      logger.error({ url, error }, 'Error downloading media from URL');
      throw error;
    }
  }

  /**
   * Send location message
   */
  private async sendLocationMessage(
    socket: any,
    jid: string,
    location: LocationContent
  ): Promise<proto.WebMessageInfo | undefined> {
    return socket.sendMessage(jid, {
      location: {
        degreesLatitude: location.latitude,
        degreesLongitude: location.longitude,
        name: location.description || '',
      },
    });
  }

  /**
   * Send poll message
   */
  private async sendPollMessage(
    socket: any,
    jid: string,
    poll: PollContent
  ): Promise<proto.WebMessageInfo | undefined> {
    return socket.sendMessage(jid, {
      poll: {
        name: poll.pollName,
        values: poll.pollOptions,
        selectableCount: poll.options?.allowMultipleAnswers ? poll.pollOptions.length : 1,
      },
    });
  }

  /**
   * Send contact message
   */
  private async sendContactMessage(
    socket: any,
    jid: string,
    contact: ContactContent
  ): Promise<proto.WebMessageInfo | undefined> {
    const contactJid = toBaileysJid(contact.contactId);
    const phoneNumber = contactJid.split('@')[0];

    // Create vCard
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${phoneNumber}
TEL;type=CELL;type=VOICE;waid=${phoneNumber}:+${phoneNumber}
END:VCARD`;

    return socket.sendMessage(jid, {
      contacts: {
        displayName: phoneNumber,
        contacts: [{ vcard }],
      },
    });
  }

  /**
   * Send buttons message (deprecated in WhatsApp - may not work)
   */
  private async sendButtonsMessage(
    socket: any,
    jid: string,
    buttons: ButtonsContent
  ): Promise<proto.WebMessageInfo | undefined> {
    // Note: Interactive buttons are largely deprecated by WhatsApp
    // This may not work for most accounts
    logger.warn('Button messages are deprecated and may not work');

    return socket.sendMessage(jid, {
      text: `${buttons.title ? buttons.title + '\n\n' : ''}${buttons.body}${buttons.footer ? '\n\n' + buttons.footer : ''}`,
    });
  }

  /**
   * Send list message (deprecated in WhatsApp - may not work)
   */
  private async sendListMessage(
    socket: any,
    jid: string,
    list: ListContent
  ): Promise<proto.WebMessageInfo | undefined> {
    // Note: List messages are largely deprecated by WhatsApp
    // This may not work for most accounts
    logger.warn('List messages are deprecated and may not work');

    return socket.sendMessage(jid, {
      text: `${list.title ? list.title + '\n\n' : ''}${list.body}${list.footer ? '\n\n' + list.footer : ''}`,
    });
  }

  /**
   * Get message for quoting
   */
  private async getQuotedMessage(socket: any, jid: string, messageId: string): Promise<proto.IWebMessageInfo | undefined> {
    // Note: Baileys requires the actual message object for quoting
    // This is a limitation - we'd need to store messages to support this properly
    return undefined;
  }

  /**
   * Fetch messages from a chat
   */
  async fetchMessages(
    sessionId: string,
    chatId: string,
    options: { limit?: number; before?: string } = {}
  ): Promise<MessageData[]> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);
    const limit = options.limit || 50;

    try {
      // Note: Baileys doesn't support fetching old messages like wwebjs
      // It only receives new messages after connection
      // This is a known limitation
      logger.warn({ sessionId, chatId }, 'fetchMessages: Baileys has limited history support');

      return [];
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error fetching messages');
      throw error;
    }
  }

  /**
   * React to a message
   */
  async reactToMessage(
    sessionId: string,
    chatId: string,
    messageId: string,
    emoji: string
  ): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.sendMessage(jid, {
        react: {
          text: emoji,
          key: {
            remoteJid: jid,
            id: messageId,
            fromMe: false, // We don't know this without storing messages
          },
        },
      });
    } catch (error) {
      logger.error({ sessionId, chatId, messageId, error }, 'Error reacting to message');
      throw error;
    }
  }

  /**
   * Star a message
   */
  async starMessage(
    sessionId: string,
    chatId: string,
    messageId: string,
    star: boolean
  ): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    // Note: Baileys doesn't have direct support for starring messages
    logger.warn({ sessionId, chatId, messageId }, 'Star message not supported in Baileys');
  }

  /**
   * Delete a message
   */
  async deleteMessage(
    sessionId: string,
    chatId: string,
    messageId: string,
    forEveryone: boolean = false
  ): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      if (forEveryone) {
        await session.socket.sendMessage(jid, {
          delete: {
            remoteJid: jid,
            id: messageId,
            fromMe: true,
          },
        });
      } else {
        // Delete for me - use chat modify
        await session.socket.chatModify(
          { clear: { messages: [{ id: messageId, fromMe: true, timestamp: Date.now() }] } },
          jid
        );
      }
    } catch (error) {
      logger.error({ sessionId, chatId, messageId, error }, 'Error deleting message');
      throw error;
    }
  }

  /**
   * Forward a message
   */
  async forwardMessage(
    sessionId: string,
    chatId: string,
    messageId: string,
    targetChatId: string
  ): Promise<MessageData | null> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    // Note: Baileys requires the actual message object for forwarding
    // This is a limitation without message storage
    logger.warn({ sessionId, chatId, messageId }, 'Forward message requires message storage');
    throw new Error('Forward message not supported without message storage');
  }

  /**
   * Download media from a message
   */
  async downloadMedia(
    sessionId: string,
    messageData: proto.IWebMessageInfo
  ): Promise<{ data: string; mimetype: string; filename?: string } | null> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    try {
      const buffer = await downloadMediaMessage(
        messageData,
        'buffer',
        {},
        {
          logger: logger as any,
          reuploadRequest: session.socket.updateMediaMessage,
        }
      );

      const message = messageData.message!;
      const type = getContentType(message)!;
      const mediaMessage = message[type as keyof typeof message] as any;

      return {
        data: buffer.toString('base64'),
        mimetype: mediaMessage?.mimetype || 'application/octet-stream',
        filename: mediaMessage?.fileName,
      };
    } catch (error) {
      logger.error({ sessionId, error }, 'Error downloading media');
      throw error;
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(sessionId: string, chatId: string, isTyping: boolean = true): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.sendPresenceUpdate(isTyping ? 'composing' : 'paused', jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error sending typing indicator');
      throw error;
    }
  }

  /**
   * Send recording indicator
   */
  async sendRecording(sessionId: string, chatId: string, isRecording: boolean = true): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.sendPresenceUpdate(isRecording ? 'recording' : 'paused', jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error sending recording indicator');
      throw error;
    }
  }

  /**
   * Mark chat as read
   */
  async markChatRead(sessionId: string, chatId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.readMessages([{ remoteJid: jid, id: 'latest' }]);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error marking chat as read');
      throw error;
    }
  }

  /**
   * Mark chat as unread
   */
  async markChatUnread(sessionId: string, chatId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.chatModify({ markRead: false }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error marking chat as unread');
      throw error;
    }
  }

  /**
   * Archive a chat
   */
  async archiveChat(sessionId: string, chatId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.chatModify({ archive: true }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error archiving chat');
      throw error;
    }
  }

  /**
   * Unarchive a chat
   */
  async unarchiveChat(sessionId: string, chatId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.chatModify({ archive: false }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error unarchiving chat');
      throw error;
    }
  }

  /**
   * Pin a chat
   */
  async pinChat(sessionId: string, chatId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.chatModify({ pin: true }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error pinning chat');
      throw error;
    }
  }

  /**
   * Unpin a chat
   */
  async unpinChat(sessionId: string, chatId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.chatModify({ pin: false }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error unpinning chat');
      throw error;
    }
  }

  /**
   * Mute a chat
   */
  async muteChat(sessionId: string, chatId: string, duration: number = 8 * 60 * 60): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.chatModify({ mute: Date.now() + duration * 1000 }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error muting chat');
      throw error;
    }
  }

  /**
   * Unmute a chat
   */
  async unmuteChat(sessionId: string, chatId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.chatModify({ mute: null }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error unmuting chat');
      throw error;
    }
  }

  /**
   * Clear chat messages
   */
  async clearChat(sessionId: string, chatId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.chatModify({ delete: true }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error clearing chat');
      throw error;
    }
  }

  /**
   * Delete a chat
   */
  async deleteChat(sessionId: string, chatId: string): Promise<void> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const jid = toBaileysJid(chatId);

    try {
      await session.socket.chatModify({ delete: true }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error deleting chat');
      throw error;
    }
  }
}

export const messageService = new MessageService();
export default messageService;
