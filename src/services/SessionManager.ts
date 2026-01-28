import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  proto,
  isJidGroup,
  getAggregateVotesInPollMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

import config, { getSessionPath } from '../config';
import logger from '../logger';
import webhookService from './WebhookService';
import { toWwebjsJid, toBaileysJid, createSerializedId, createMessageId, getPhoneNumber, isGroupJid } from '../utils/jidHelper';
import type { BaileysSession, SessionStatus, ChatData, ContactData, MessageData, GroupMetadata, LabelData } from '../types';

class SessionManager {
  private sessions: Map<string, BaileysSession> = new Map();
  private initializingSessionId: string | null = null;

  constructor() {
    // Ensure sessions directory exists
    if (!fs.existsSync(config.sessionsPath)) {
      fs.mkdirSync(config.sessionsPath, { recursive: true });
    }
  }

  /**
   * Get all session IDs
   */
  getAllSessionIds(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): BaileysSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if session exists
   */
  hasSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Check if session is connected
   */
  isConnected(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.status === 'connected';
  }

  /**
   * Get session status
   */
  getStatus(sessionId: string): SessionStatus | null {
    return this.sessions.get(sessionId)?.status ?? null;
  }

  /**
   * Get QR code for session
   */
  getQr(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.qr ?? null;
  }

  /**
   * Get pairing code for session
   */
  getPairingCode(sessionId: string): string | null {
    return this.sessions.get(sessionId)?.pairingCode ?? null;
  }

  /**
   * Start a new session
   */
  async startSession(sessionId: string): Promise<BaileysSession> {
    // If session already exists and is connected, return it
    if (this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId)!;
      if (existing.status === 'connected') {
        logger.info({ sessionId }, 'Session already connected');
        return existing;
      }
      // If disconnected, clean up and restart
      await this.stopSession(sessionId);
    }

    logger.info({ sessionId }, 'Starting new session');
    this.initializingSessionId = sessionId;

    const sessionPath = getSessionPath(sessionId);

    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    // Fetch latest version
    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info({ version, isLatest }, 'Using Baileys version');

    // Create socket with silent logger
    const silentLogger = pino({ level: 'silent' });

    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
      },
      printQRInTerminal: false,
      logger: silentLogger,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    // Create session object
    const session: BaileysSession = {
      socket,
      qr: null,
      pairingCode: null,
      status: 'connecting',
      saveCreds,
      reconnectAttempts: 0,
    };

    this.sessions.set(sessionId, session);

    // Set up event handlers
    this.setupEventHandlers(sessionId, socket, session);

    return session;
  }

  /**
   * Set up event handlers for a session
   */
  private setupEventHandlers(sessionId: string, socket: WASocket, session: BaileysSession): void {
    // Connection update
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.qr = qr;
        session.status = 'qr';
        logger.info({ sessionId }, 'QR code generated');
        await webhookService.sendQr(sessionId, qr);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        logger.info({ sessionId, statusCode, shouldReconnect }, 'Connection closed');

        session.status = 'disconnected';
        session.qr = null;

        if (shouldReconnect && session.reconnectAttempts < config.maxReconnectRetries) {
          session.reconnectAttempts++;
          logger.info({ sessionId, attempt: session.reconnectAttempts }, 'Attempting reconnection');
          setTimeout(() => {
            this.startSession(sessionId).catch((err) => {
              logger.error({ sessionId, error: err.message }, 'Reconnection failed');
            });
          }, config.reconnectInterval);
        } else {
          await webhookService.sendDisconnected(sessionId,
            statusCode === DisconnectReason.loggedOut ? 'logged_out' : 'connection_lost'
          );

          if (statusCode === DisconnectReason.loggedOut) {
            await this.terminateSession(sessionId);
          }
        }
      }

      if (connection === 'open') {
        session.status = 'connected';
        session.qr = null;
        session.reconnectAttempts = 0;
        logger.info({ sessionId }, 'Session connected');

        // Get user info
        const user = socket.user;
        await webhookService.sendAuthenticated(sessionId);
        await webhookService.sendReady(sessionId, {
          id: user ? toWwebjsJid(user.id) : null,
          pushname: user?.name || null,
        });
      }
    });

    // Credentials update
    socket.ev.on('creds.update', session.saveCreds);

    // Messages
    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      for (const msg of messages) {
        if (msg.key && msg.message) {
          const formattedMsg = this.formatMessage(msg);

          if (type === 'notify') {
            await webhookService.sendMessageCreate(sessionId, formattedMsg);
            if (!msg.key.fromMe) {
              await webhookService.sendMessage(sessionId, formattedMsg);
            }
          }
        }
      }
    });

    // Message status updates
    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (update.update.status) {
          const ack = this.mapStatusToAck(update.update.status);
          await webhookService.sendMessageAck(sessionId, {
            id: createMessageId(
              update.key.id!,
              update.key.remoteJid!,
              update.key.fromMe || false
            ),
          }, ack);
        }
      }
    });

    // Message reactions
    socket.ev.on('messages.reaction', async (reactions) => {
      for (const reaction of reactions) {
        await webhookService.sendMessageReaction(sessionId, {
          id: createMessageId(
            reaction.key.id!,
            reaction.key.remoteJid!,
            reaction.key.fromMe || false
          ),
          reaction: reaction.reaction,
        });
      }
    });

    // Group updates
    socket.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
        await webhookService.sendGroupUpdate(sessionId, {
          id: createSerializedId(update.id!),
          ...update,
        });
      }
    });

    // Group participants update
    socket.ev.on('group-participants.update', async (update) => {
      const { id, participants, action } = update;

      for (const participant of participants) {
        const notification = {
          id: createSerializedId(id),
          participant: toWwebjsJid(participant),
          action,
        };

        if (action === 'add') {
          await webhookService.sendGroupJoin(sessionId, notification);
        } else if (action === 'remove') {
          await webhookService.sendGroupLeave(sessionId, notification);
        }
      }
    });

    // Calls
    socket.ev.on('call', async (calls) => {
      for (const call of calls) {
        await webhookService.sendCall(sessionId, {
          id: call.id,
          from: toWwebjsJid(call.from),
          isVideo: call.isVideo,
          isGroup: call.isGroup,
          status: call.status,
        });
      }
    });

    // Presence updates (typing, online status)
    socket.ev.on('presence.update', async (update) => {
      // Could be used for typing indicators
      logger.debug({ sessionId, update }, 'Presence update');
    });

    // Chats update
    socket.ev.on('chats.update', async (updates) => {
      for (const update of updates) {
        if (update.unreadCount !== undefined) {
          await webhookService.sendUnreadCount(sessionId, {
            id: createSerializedId(update.id!),
            unreadCount: update.unreadCount,
          });
        }
        if (update.archived !== undefined) {
          await webhookService.sendChatArchived(sessionId, {
            id: createSerializedId(update.id!),
          }, update.archived);
        }
      }
    });

    // Chats delete
    socket.ev.on('chats.delete', async (deletions) => {
      for (const jid of deletions) {
        await webhookService.sendChatRemoved(sessionId, {
          id: createSerializedId(jid),
        });
      }
    });

    // Contacts update
    socket.ev.on('contacts.update', async (updates) => {
      for (const update of updates) {
        await webhookService.sendContactChanged(sessionId, null,
          toWwebjsJid(update.id!),
          toWwebjsJid(update.id!)
        );
      }
    });

    // Labels (business accounts)
    socket.ev.on('labels.association', async (association) => {
      logger.debug({ sessionId, association }, 'Label association');
    });
  }

  /**
   * Format a Baileys message to wwebjs format
   */
  formatMessage(msg: proto.IWebMessageInfo): MessageData {
    const key = msg.key!;
    const message = msg.message!;

    // Determine message type and body
    let type = 'chat';
    let body = '';
    let hasMedia = false;

    if (message.conversation) {
      body = message.conversation;
    } else if (message.extendedTextMessage) {
      body = message.extendedTextMessage.text || '';
    } else if (message.imageMessage) {
      type = 'image';
      body = message.imageMessage.caption || '';
      hasMedia = true;
    } else if (message.videoMessage) {
      type = 'video';
      body = message.videoMessage.caption || '';
      hasMedia = true;
    } else if (message.audioMessage) {
      type = message.audioMessage.ptt ? 'ptt' : 'audio';
      hasMedia = true;
    } else if (message.documentMessage) {
      type = 'document';
      body = message.documentMessage.fileName || '';
      hasMedia = true;
    } else if (message.stickerMessage) {
      type = 'sticker';
      hasMedia = true;
    } else if (message.contactMessage) {
      type = 'vcard';
      body = message.contactMessage.vcard || '';
    } else if (message.contactsArrayMessage) {
      type = 'multi_vcard';
    } else if (message.locationMessage) {
      type = 'location';
    } else if (message.liveLocationMessage) {
      type = 'live_location';
    } else if (message.pollCreationMessage || message.pollCreationMessageV2 || message.pollCreationMessageV3) {
      type = 'poll';
      const pollMsg = message.pollCreationMessage || message.pollCreationMessageV2 || message.pollCreationMessageV3;
      body = pollMsg?.name || '';
    } else if (message.reactionMessage) {
      type = 'reaction';
      body = message.reactionMessage.text || '';
    } else if (message.protocolMessage) {
      if (message.protocolMessage.type === proto.Message.ProtocolMessage.Type.REVOKE) {
        type = 'revoked';
      }
    }

    // Get forwarding info
    const contextInfo =
      message.extendedTextMessage?.contextInfo ||
      message.imageMessage?.contextInfo ||
      message.videoMessage?.contextInfo ||
      message.documentMessage?.contextInfo ||
      message.audioMessage?.contextInfo;

    const isForwarded = contextInfo?.isForwarded || false;
    const forwardingScore = contextInfo?.forwardingScore || 0;

    // Get quoted message info
    const hasQuotedMsg = !!contextInfo?.quotedMessage;

    // Get mentions
    const mentionedIds = (contextInfo?.mentionedJid || []).map(toWwebjsJid);

    // Get links
    const links: Array<{ link: string; isSuspicious: boolean }> = [];
    if (message.extendedTextMessage?.matchedText) {
      links.push({ link: message.extendedTextMessage.matchedText, isSuspicious: false });
    }

    const remoteJid = key.remoteJid!;
    const fromJid = key.fromMe
      ? (this.sessions.get(this.initializingSessionId!)?.socket.user?.id || remoteJid)
      : (key.participant || remoteJid);
    const toJid = key.fromMe ? remoteJid : (this.sessions.get(this.initializingSessionId!)?.socket.user?.id || remoteJid);

    return {
      id: createMessageId(key.id!, remoteJid, key.fromMe || false),
      body,
      type,
      timestamp: msg.messageTimestamp as number || Math.floor(Date.now() / 1000),
      from: toWwebjsJid(fromJid),
      to: toWwebjsJid(toJid),
      author: key.participant ? toWwebjsJid(key.participant) : undefined,
      isForwarded,
      forwardingScore,
      isStatus: remoteJid === 'status@broadcast',
      isStarred: msg.starred || false,
      broadcast: remoteJid.endsWith('@broadcast'),
      fromMe: key.fromMe || false,
      hasQuotedMsg,
      hasMedia,
      hasReaction: false,
      ack: this.mapStatusToAck(msg.status),
      mentionedIds,
      groupMentions: [],
      links,
      _data: msg,
    };
  }

  /**
   * Map Baileys status to wwebjs ack
   */
  private mapStatusToAck(status?: proto.WebMessageInfo.Status | number): number {
    switch (status) {
      case proto.WebMessageInfo.Status.ERROR:
        return -1;
      case proto.WebMessageInfo.Status.PENDING:
        return 0;
      case proto.WebMessageInfo.Status.SERVER_ACK:
        return 1;
      case proto.WebMessageInfo.Status.DELIVERY_ACK:
        return 2;
      case proto.WebMessageInfo.Status.READ:
        return 3;
      case proto.WebMessageInfo.Status.PLAYED:
        return 4;
      default:
        return 0;
    }
  }

  /**
   * Stop a session without clearing auth
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info({ sessionId }, 'Stopping session');

    try {
      session.socket.end(undefined);
    } catch (error) {
      logger.warn({ sessionId, error }, 'Error ending socket');
    }

    this.sessions.delete(sessionId);
  }

  /**
   * Terminate session and clear auth
   */
  async terminateSession(sessionId: string): Promise<void> {
    logger.info({ sessionId }, 'Terminating session');

    await this.stopSession(sessionId);

    // Delete auth files
    const sessionPath = getSessionPath(sessionId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      logger.info({ sessionId, path: sessionPath }, 'Auth files deleted');
    }
  }

  /**
   * Logout and terminate session
   */
  async logoutSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    logger.info({ sessionId }, 'Logging out session');

    try {
      await session.socket.logout();
    } catch (error) {
      logger.warn({ sessionId, error }, 'Error during logout');
    }

    await this.terminateSession(sessionId);
  }

  /**
   * Request pairing code for phone number linking
   */
  async requestPairingCode(sessionId: string, phoneNumber: string): Promise<string | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    try {
      // Clean phone number (remove any non-digits)
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      session.phoneNumber = cleanNumber;
      session.status = 'pairing';

      const code = await session.socket.requestPairingCode(cleanNumber);
      session.pairingCode = code;

      logger.info({ sessionId, phoneNumber: cleanNumber }, 'Pairing code requested');
      return code;
    } catch (error) {
      logger.error({ sessionId, error }, 'Failed to request pairing code');
      throw error;
    }
  }

  /**
   * Get all chats
   */
  async getChats(sessionId: string): Promise<ChatData[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return [];

    const store = session.socket.store;
    const chats: ChatData[] = [];

    try {
      // Get chats from the socket store
      const allChats = await session.socket.groupFetchAllParticipating();

      // Combine with individual chats
      // Note: Baileys doesn't have a direct "get all chats" like wwebjs
      // This is a limitation - we may need to track chats as messages come in

      for (const [jid, metadata] of Object.entries(allChats)) {
        chats.push({
          id: createSerializedId(jid),
          name: metadata.subject || getPhoneNumber(jid),
          isGroup: true,
          isReadOnly: metadata.announce || false,
          unreadCount: 0,
          timestamp: metadata.creation || 0,
          archived: false,
          pinned: false,
          isMuted: false,
        });
      }
    } catch (error) {
      logger.error({ sessionId, error }, 'Error fetching chats');
    }

    return chats;
  }

  /**
   * Get chat by ID
   */
  async getChatById(sessionId: string, chatId: string): Promise<ChatData | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return null;

    const jid = toBaileysJid(chatId);

    try {
      if (isGroupJid(jid)) {
        const metadata = await session.socket.groupMetadata(jid);
        return {
          id: createSerializedId(jid),
          name: metadata.subject,
          isGroup: true,
          isReadOnly: metadata.announce || false,
          unreadCount: 0,
          timestamp: metadata.creation || 0,
          archived: false,
          pinned: false,
          isMuted: false,
        };
      } else {
        // Individual chat
        return {
          id: createSerializedId(jid),
          name: getPhoneNumber(jid),
          isGroup: false,
          isReadOnly: false,
          unreadCount: 0,
          timestamp: 0,
          archived: false,
          pinned: false,
          isMuted: false,
        };
      }
    } catch (error) {
      logger.error({ sessionId, chatId, error }, 'Error fetching chat');
      return null;
    }
  }

  /**
   * Get all contacts
   */
  async getContacts(sessionId: string): Promise<ContactData[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return [];

    // Note: Baileys doesn't maintain a contact list like wwebjs
    // Contacts are typically discovered through chats and messages
    return [];
  }

  /**
   * Get contact by ID
   */
  async getContactById(sessionId: string, contactId: string): Promise<ContactData | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return null;

    const jid = toBaileysJid(contactId);

    try {
      // Try to get profile picture and status
      let profilePicUrl: string | undefined;
      try {
        profilePicUrl = await session.socket.profilePictureUrl(jid, 'image');
      } catch {
        // Profile picture not available
      }

      const phoneNumber = getPhoneNumber(jid);

      return {
        id: createSerializedId(jid),
        number: phoneNumber,
        name: phoneNumber,
        shortName: phoneNumber,
        pushname: phoneNumber,
        isUser: !isGroupJid(jid),
        isGroup: isGroupJid(jid),
        isWAContact: true,
        isMyContact: false,
        isBlocked: false,
      };
    } catch (error) {
      logger.error({ sessionId, contactId, error }, 'Error fetching contact');
      return null;
    }
  }

  /**
   * Check if user is registered on WhatsApp
   */
  async isRegisteredUser(sessionId: string, contactId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return false;

    const jid = toBaileysJid(contactId);

    try {
      const [result] = await session.socket.onWhatsApp(getPhoneNumber(jid));
      return result?.exists || false;
    } catch (error) {
      logger.error({ sessionId, contactId, error }, 'Error checking registration');
      return false;
    }
  }

  /**
   * Get client info
   */
  getClientInfo(sessionId: string): { pushname: string; wid: { _serialized: string } } | null {
    const session = this.sessions.get(sessionId);
    if (!session || !session.socket.user) return null;

    return {
      pushname: session.socket.user.name || '',
      wid: createSerializedId(session.socket.user.id),
    };
  }

  /**
   * Get group metadata
   */
  async getGroupMetadata(sessionId: string, groupId: string): Promise<GroupMetadata | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return null;

    const jid = toBaileysJid(groupId);

    try {
      const metadata = await session.socket.groupMetadata(jid);

      return {
        id: createSerializedId(jid),
        owner: metadata.owner ? toWwebjsJid(metadata.owner) : '',
        subject: metadata.subject,
        creation: metadata.creation || 0,
        desc: metadata.desc || '',
        descId: metadata.descId || '',
        descOwner: metadata.descOwner ? toWwebjsJid(metadata.descOwner) : '',
        participants: metadata.participants.map((p) => ({
          id: createSerializedId(p.id),
          isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
          isSuperAdmin: p.admin === 'superadmin',
        })),
        announce: metadata.announce || false,
        restrict: metadata.restrict || false,
        size: metadata.size || metadata.participants.length,
      };
    } catch (error) {
      logger.error({ sessionId, groupId, error }, 'Error fetching group metadata');
      return null;
    }
  }

  /**
   * Get labels (business accounts only)
   */
  async getLabels(sessionId: string): Promise<LabelData[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') return [];

    // Note: Labels are specific to WhatsApp Business
    // Baileys has limited support for labels
    return [];
  }

  /**
   * Auto-start existing sessions
   */
  async autoStartSessions(): Promise<void> {
    if (!config.autoStartSessions) return;

    logger.info('Auto-starting existing sessions');

    if (!fs.existsSync(config.sessionsPath)) return;

    const entries = fs.readdirSync(config.sessionsPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.startsWith('session-')) {
        const sessionId = entry.name.replace('session-', '');
        logger.info({ sessionId }, 'Auto-starting session');

        try {
          await this.startSession(sessionId);
        } catch (error) {
          logger.error({ sessionId, error }, 'Failed to auto-start session');
        }
      }
    }
  }
}

export const sessionManager = new SessionManager();
export default sessionManager;
