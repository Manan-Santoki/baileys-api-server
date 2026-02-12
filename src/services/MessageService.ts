import { proto, downloadMediaMessage, getContentType, WAMessageKey } from '@whiskeysockets/baileys';
import axios from 'axios';
import path from 'path';
import { getLinkPreview } from 'link-preview-js';

import sessionManager from './SessionManager';
import logger from '../logger';
import { toBaileysJid } from '../utils/jidHelper';
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
          result = await this.sendTextMessage(sessionId, jid, options.content as string, options.options);
          break;

        case 'MessageMedia':
          result = await this.sendMediaMessage(sessionId, jid, options.content as MediaContent, options.options);
          break;

        case 'MessageMediaFromURL':
          result = await this.sendMediaFromUrl(sessionId, jid, options.content as string, options.options);
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
        return sessionManager.formatMessage(result, sessionId);
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
    sessionId: string,
    jid: string,
    text: string,
    options?: SendMessageOptions['options']
  ): Promise<proto.WebMessageInfo | undefined> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const messageOptions: Record<string, unknown> = {
      text,
    };

    if (options?.quotedMessageId) {
      const quoted = await this.getQuotedMessage(sessionId, jid, options.quotedMessageId);
      if (quoted) {
        messageOptions.quoted = quoted;
      }
    }

    if (options?.mentions?.length) {
      messageOptions.mentions = options.mentions.map(toBaileysJid);
    }

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
        logger.debug({ error }, 'Link preview failed');
      }
    }

    return session.socket.sendMessage(jid, messageOptions as any);
  }

  /**
   * Send media message (image, video, audio, document)
   */
  private async sendMediaMessage(
    sessionId: string,
    jid: string,
    media: MediaContent,
    options?: SendMessageOptions['options']
  ): Promise<proto.WebMessageInfo | undefined> {
    const session = sessionManager.getSession(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const buffer = Buffer.from(media.data, 'base64');
    const mimetype = media.mimetype;

    const messageOptions: Record<string, unknown> = {};

    if (options?.quotedMessageId) {
      const quoted = await this.getQuotedMessage(sessionId, jid, options.quotedMessageId);
      if (quoted) {
        messageOptions.quoted = quoted;
      }
    }

    if (options?.mentions?.length) {
      messageOptions.mentions = options.mentions.map(toBaileysJid);
    }

    if (mimetype.startsWith('image/')) {
      return session.socket.sendMessage(jid, {
        image: buffer,
        caption: options?.caption || media.filename || '',
        mimetype,
        ...messageOptions,
      });
    }

    if (mimetype.startsWith('video/')) {
      return session.socket.sendMessage(jid, {
        video: buffer,
        caption: options?.caption || media.filename || '',
        mimetype,
        gifPlayback: options?.sendVideoAsGif || false,
        ...messageOptions,
      });
    }

    if (mimetype.startsWith('audio/')) {
      return session.socket.sendMessage(jid, {
        audio: buffer,
        mimetype,
        ptt: options?.sendAudioAsVoice || false,
        ...messageOptions,
      });
    }

    return session.socket.sendMessage(jid, {
      document: buffer,
      fileName: media.filename || 'file',
      mimetype,
      ...messageOptions,
    });
  }

  /**
   * Send media from URL
   */
  private async sendMediaFromUrl(
    sessionId: string,
    jid: string,
    url: string,
    options?: SendMessageOptions['options']
  ): Promise<proto.WebMessageInfo | undefined> {
    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      });

      const buffer = Buffer.from(response.data);
      const contentType = response.headers['content-type'] || 'application/octet-stream';

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

      return this.sendMediaMessage(sessionId, jid, media, options);
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

    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${phoneNumber}\nTEL;type=CELL;type=VOICE;waid=${phoneNumber}:+${phoneNumber}\nEND:VCARD`;

    return socket.sendMessage(jid, {
      contacts: {
        displayName: phoneNumber,
        contacts: [{ vcard }],
      },
    });
  }

  /**
   * Send buttons message (deprecated in WhatsApp - fallback to plain text)
   */
  private async sendButtonsMessage(
    socket: any,
    jid: string,
    buttons: ButtonsContent
  ): Promise<proto.WebMessageInfo | undefined> {
    logger.warn('Button messages are deprecated and may not work in all clients');

    return socket.sendMessage(jid, {
      text: `${buttons.title ? `${buttons.title}\n\n` : ''}${buttons.body}${buttons.footer ? `\n\n${buttons.footer}` : ''}`,
    });
  }

  /**
   * Send list message (deprecated in WhatsApp - fallback to plain text)
   */
  private async sendListMessage(
    socket: any,
    jid: string,
    list: ListContent
  ): Promise<proto.WebMessageInfo | undefined> {
    logger.warn('List messages are deprecated and may not work in all clients');

    return socket.sendMessage(jid, {
      text: `${list.title ? `${list.title}\n\n` : ''}${list.body}${list.footer ? `\n\n${list.footer}` : ''}`,
    });
  }

  /**
   * Get message for quoting
   */
  private async getQuotedMessage(
    sessionId: string,
    chatJid: string,
    messageId: string
  ): Promise<proto.IWebMessageInfo | undefined> {
    const message = await sessionManager.getMessageById(sessionId, chatJid, messageId);
    return message || undefined;
  }

  /**
   * Fetch messages from a chat (from local session store)
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

    const limit = Math.max(1, Math.min(Number(options.limit || 50), 500));

    try {
      const allMessages = sessionManager.getMessagesForChat(sessionId, chatId);

      let startIndex = 0;
      if (options.before) {
        try {
          const beforeKey = await sessionManager.resolveMessageKey(sessionId, chatId, options.before);
          const idx = allMessages.findIndex((message) => message.key?.id === beforeKey.id);
          if (idx >= 0) {
            startIndex = idx + 1;
          }
        } catch {
          startIndex = 0;
        }
      }

      return allMessages
        .slice(startIndex, startIndex + limit)
        .map((message) => sessionManager.formatMessage(message, sessionId));
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

    const messageKey = await this.resolveMessageKeyWithRemote(sessionId, chatId, messageId);

    try {
      await session.socket.sendMessage(messageKey.remoteJid!, {
        react: {
          text: emoji,
          key: messageKey,
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

    const messageKey = await this.resolveMessageKeyWithRemote(sessionId, chatId, messageId);

    if (!messageKey.id) {
      throw new Error('Invalid message key');
    }

    await session.socket.star(
      messageKey.remoteJid!,
      [{ id: messageKey.id, fromMe: typeof messageKey.fromMe === 'boolean' ? messageKey.fromMe : undefined }],
      star
    );
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

    const messageKey = await this.resolveMessageKeyWithRemote(sessionId, chatId, messageId);

    try {
      if (forEveryone) {
        await session.socket.sendMessage(messageKey.remoteJid!, {
          delete: messageKey,
        });
      } else {
        await session.socket.chatModify(
          {
            deleteForMe: {
              key: messageKey,
              timestamp: Date.now(),
              deleteMedia: false,
            },
          },
          messageKey.remoteJid!
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

    const sourceMessage = await sessionManager.getMessageById(sessionId, chatId, messageId);
    if (!sourceMessage) {
      throw new Error('Source message not found in local store');
    }

    const targetJid = toBaileysJid(targetChatId);

    try {
      const forwarded = await session.socket.sendMessage(targetJid, {
        forward: sourceMessage,
        force: false,
      });

      if (!forwarded) {
        return null;
      }

      return sessionManager.formatMessage(forwarded, sessionId);
    } catch (error) {
      logger.error({ sessionId, chatId, messageId, targetChatId, error }, 'Error forwarding message');
      throw error;
    }
  }

  /**
   * Download media from a message object
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

      const message = messageData.message;
      if (!message) {
        throw new Error('Message payload is missing');
      }

      const type = getContentType(message);
      if (!type) {
        throw new Error('Message does not contain downloadable media');
      }

      const mediaMessage = message[type as keyof typeof message] as { mimetype?: string; fileName?: string } | undefined;

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
   * Download media from chat + message ID
   */
  async downloadMediaById(
    sessionId: string,
    chatId: string,
    messageId: string
  ): Promise<{ data: string; mimetype: string; filename?: string } | null> {
    const message = await sessionManager.getMessageById(sessionId, chatId, messageId);
    if (!message) {
      throw new Error('Message not found in local store');
    }

    return this.downloadMedia(sessionId, message);
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

    const lastMessages = this.getLastMessageKeys(sessionId, chatId, 1);
    if (lastMessages.length === 0) {
      return;
    }

    try {
      await session.socket.readMessages(lastMessages);
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
    const lastMessages = this.getChatModifyLastMessages(sessionId, chatId, 1);

    try {
      await session.socket.chatModify({ markRead: false, lastMessages }, jid);
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
    const lastMessages = this.getChatModifyLastMessages(sessionId, chatId, 1);

    try {
      await session.socket.chatModify({ archive: true, lastMessages }, jid);
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
    const lastMessages = this.getChatModifyLastMessages(sessionId, chatId, 1);

    try {
      await session.socket.chatModify({ archive: false, lastMessages }, jid);
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
      await session.socket.chatModify({ clear: true }, jid);
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
    const lastMessages = this.getChatModifyLastMessages(sessionId, chatId, 1);

    try {
      await session.socket.chatModify({ delete: true, lastMessages }, jid);
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error deleting chat');
      throw error;
    }
  }

  private getChatModifyLastMessages(
    sessionId: string,
    chatId: string,
    count: number
  ): Array<{ key: WAMessageKey; messageTimestamp: number }> {
    const messages = sessionManager.getLastMessages(sessionId, chatId, count);

    const payload = messages
      .filter((message) => !!message.key?.id)
      .map((message) => ({
        key: message.key as WAMessageKey,
        messageTimestamp: this.toTimestamp(message.messageTimestamp),
      }));

    if (payload.length === 0) {
      throw new Error('No local messages found in this chat. Receive at least one message before modifying chat state.');
    }

    return payload;
  }

  private getLastMessageKeys(sessionId: string, chatId: string, count: number): WAMessageKey[] {
    return sessionManager
      .getLastMessages(sessionId, chatId, count)
      .map((message) => message.key)
      .filter((key): key is WAMessageKey => !!key?.id && !!key.remoteJid);
  }

  private async resolveMessageKeyWithRemote(
    sessionId: string,
    chatId: string,
    messageId: string
  ): Promise<WAMessageKey> {
    const key = await sessionManager.resolveMessageKey(sessionId, chatId, messageId);
    const remoteJid = key.remoteJid || toBaileysJid(chatId);
    return {
      ...key,
      remoteJid,
    };
  }

  private toTimestamp(value: unknown): number {
    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'bigint') {
      return Number(value);
    }

    if (!value || typeof value !== 'object') {
      return Math.floor(Date.now() / 1000);
    }

    if ('toNumber' in value && typeof (value as { toNumber: () => number }).toNumber === 'function') {
      return (value as { toNumber: () => number }).toNumber();
    }

    if ('low' in value && typeof (value as { low: number }).low === 'number') {
      return (value as { low: number }).low;
    }

    return Math.floor(Date.now() / 1000);
  }
}

export const messageService = new MessageService();
export default messageService;
