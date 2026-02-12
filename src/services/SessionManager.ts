import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  WASocket,
  WAMessageKey,
  proto,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

import config, { getSessionPath } from '../config';
import logger from '../logger';
import webhookService from './WebhookService';
import {
  toWwebjsJid,
  toBaileysJid,
  createSerializedId,
  createMessageId,
  getPhoneNumber,
  isGroupJid,
} from '../utils/jidHelper';
import type {
  BaileysSession,
  SessionStatus,
  ChatData,
  ContactData,
  MessageData,
  GroupMetadata,
  LabelData,
} from '../types';

class SessionManager {
  private sessions: Map<string, BaileysSession> = new Map();
  private storePersistTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private stoppingSessions: Set<string> = new Set();

  constructor() {
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
    if (this.sessions.has(sessionId)) {
      const existing = this.sessions.get(sessionId)!;
      if (existing.status === 'connected') {
        logger.info({ sessionId }, 'Session already connected');
        return existing;
      }
      await this.stopSession(sessionId);
    }

    logger.info({ sessionId }, 'Starting new session');

    const sessionPath = getSessionPath(sessionId);
    fs.mkdirSync(sessionPath, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const { version, isLatest } = await fetchLatestBaileysVersion();
    logger.info({ version, isLatest }, 'Using Baileys version');

    const silentLogger = pino({ level: 'silent' });
    const store = makeInMemoryStore({ logger: silentLogger });
    const storePath = path.join(sessionPath, 'store.json');

    if (fs.existsSync(storePath)) {
      try {
        store.readFromFile(storePath);
      } catch (error) {
        logger.warn({ sessionId, error }, 'Failed to load session store file');
      }
    }

    const socket = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
      },
      getMessage: async (key: WAMessageKey) => {
        if (!key.remoteJid || !key.id) {
          return undefined;
        }

        const stored = await store.loadMessage(key.remoteJid, key.id).catch(() => undefined);
        return stored?.message || undefined;
      },
      cachedGroupMetadata: async (jid: string) => store.groupMetadata[jid],
      printQRInTerminal: false,
      logger: silentLogger,
      generateHighQualityLinkPreview: true,
      syncFullHistory: true,
      markOnlineOnConnect: true,
    });

    const session: BaileysSession = {
      socket,
      store,
      storePath,
      messageKeyIndex: new Map<string, WAMessageKey>(),
      qr: null,
      pairingCode: null,
      status: 'connecting',
      saveCreds,
      reconnectAttempts: 0,
    };

    this.sessions.set(sessionId, session);

    store.bind(socket.ev);
    this.indexExistingMessages(sessionId);
    this.setupEventHandlers(sessionId, socket, session);

    return session;
  }

  /**
   * Set up event handlers for a session
   */
  private setupEventHandlers(sessionId: string, socket: WASocket, session: BaileysSession): void {
    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        session.qr = qr;
        session.status = 'qr';
        logger.info({ sessionId }, 'QR code generated');
        await webhookService.sendQr(sessionId, qr);
      }

      if (connection === 'close') {
        const manualStop = this.stoppingSessions.has(sessionId);
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = !manualStop && statusCode !== DisconnectReason.loggedOut;

        logger.info({ sessionId, statusCode, shouldReconnect, manualStop }, 'Connection closed');

        session.status = 'disconnected';
        session.qr = null;
        this.scheduleStorePersist(sessionId);

        if (manualStop) {
          return;
        }

        if (shouldReconnect && session.reconnectAttempts < config.maxReconnectRetries) {
          session.reconnectAttempts += 1;
          logger.info({ sessionId, attempt: session.reconnectAttempts }, 'Attempting reconnection');
          setTimeout(() => {
            this.startSession(sessionId).catch((err: Error) => {
              logger.error({ sessionId, error: err.message }, 'Reconnection failed');
            });
          }, config.reconnectInterval);
        } else {
          await webhookService.sendDisconnected(
            sessionId,
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

        const user = socket.user;
        await webhookService.sendAuthenticated(sessionId);
        await webhookService.sendReady(sessionId, {
          id: user ? toWwebjsJid(user.id) : null,
          pushname: user?.name || null,
        });
      }
    });

    socket.ev.on('creds.update', session.saveCreds);

    socket.ev.on('messaging-history.set', ({ messages }) => {
      for (const message of messages || []) {
        this.registerMessageKey(sessionId, message.key);
      }
      this.scheduleStorePersist(sessionId);
    });

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      for (const msg of messages) {
        this.registerMessageKey(sessionId, msg.key);

        if (msg.key && msg.message) {
          const formattedMsg = this.formatMessage(msg, sessionId);

          if (type === 'notify') {
            await webhookService.sendMessageCreate(sessionId, formattedMsg);
            if (!msg.key.fromMe) {
              await webhookService.sendMessage(sessionId, formattedMsg);
            }
          }
        }
      }

      this.scheduleStorePersist(sessionId);
    });

    socket.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        this.registerMessageKey(sessionId, update.key);

        if (update.update.status !== undefined && update.key.id && update.key.remoteJid) {
          const ack = this.mapStatusToAck(update.update.status ?? undefined);
          await webhookService.sendMessageAck(
            sessionId,
            {
              id: createMessageId(update.key.id, update.key.remoteJid, update.key.fromMe || false),
            },
            ack
          );
        }
      }

      this.scheduleStorePersist(sessionId);
    });

    socket.ev.on('messages.reaction', async (reactions) => {
      for (const reaction of reactions) {
        this.registerMessageKey(sessionId, reaction.key);

        if (!reaction.key.id || !reaction.key.remoteJid) {
          continue;
        }

        await webhookService.sendMessageReaction(sessionId, {
          id: createMessageId(reaction.key.id, reaction.key.remoteJid, reaction.key.fromMe || false),
          reaction: reaction.reaction,
        });
      }

      this.scheduleStorePersist(sessionId);
    });

    socket.ev.on('groups.update', async (updates) => {
      for (const update of updates) {
        if (!update.id) {
          continue;
        }

        await webhookService.sendGroupUpdate(sessionId, {
          id: createSerializedId(update.id),
          ...update,
        });
      }

      this.scheduleStorePersist(sessionId);
    });

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

      this.scheduleStorePersist(sessionId);
    });

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

    socket.ev.on('presence.update', async (update) => {
      logger.debug({ sessionId, update }, 'Presence update');
    });

    socket.ev.on('chats.update', async (updates) => {
      for (const update of updates) {
        if (update.unreadCount !== undefined && update.id) {
          await webhookService.sendUnreadCount(sessionId, {
            id: createSerializedId(update.id),
            unreadCount: update.unreadCount,
          });
        }

        if (update.archived !== undefined && update.id) {
          await webhookService.sendChatArchived(
            sessionId,
            {
              id: createSerializedId(update.id),
            },
            !!update.archived
          );
        }
      }

      this.scheduleStorePersist(sessionId);
    });

    socket.ev.on('chats.delete', async (deletions) => {
      for (const jid of deletions) {
        await webhookService.sendChatRemoved(sessionId, {
          id: createSerializedId(jid),
        });
      }

      this.scheduleStorePersist(sessionId);
    });

    socket.ev.on('contacts.update', async (updates) => {
      for (const update of updates) {
        if (!update.id) {
          continue;
        }

        await webhookService.sendContactChanged(sessionId, null, toWwebjsJid(update.id), toWwebjsJid(update.id));
      }

      this.scheduleStorePersist(sessionId);
    });

    socket.ev.on('contacts.upsert', () => {
      this.scheduleStorePersist(sessionId);
    });

    socket.ev.on('labels.association', async (association) => {
      logger.debug({ sessionId, association }, 'Label association');
      this.scheduleStorePersist(sessionId);
    });
  }

  /**
   * Format a Baileys message to wwebjs-like format
   */
  formatMessage(msg: proto.IWebMessageInfo, sessionId?: string): MessageData {
    const key = msg.key || {};
    const message = msg.message || {};

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
    } else if (message.protocolMessage?.type === proto.Message.ProtocolMessage.Type.REVOKE) {
      type = 'revoked';
    }

    const contextInfo =
      message.extendedTextMessage?.contextInfo ||
      message.imageMessage?.contextInfo ||
      message.videoMessage?.contextInfo ||
      message.documentMessage?.contextInfo ||
      message.audioMessage?.contextInfo;

    const isForwarded = contextInfo?.isForwarded || false;
    const forwardingScore = contextInfo?.forwardingScore || 0;
    const hasQuotedMsg = !!contextInfo?.quotedMessage;
    const mentionedIds = (contextInfo?.mentionedJid || []).map(toWwebjsJid);

    const links: Array<{ link: string; isSuspicious: boolean }> = [];
    if (message.extendedTextMessage?.matchedText) {
      links.push({ link: message.extendedTextMessage.matchedText, isSuspicious: false });
    }

    const remoteJid = key.remoteJid || '';
    const participant = key.participant || (key as proto.IMessageKey & { participantAlt?: string }).participantAlt;
    const ownJid = sessionId ? this.sessions.get(sessionId)?.socket.user?.id : undefined;

    const fromJid = key.fromMe ? (ownJid || remoteJid) : (participant || remoteJid);
    const toJid = key.fromMe ? remoteJid : (ownJid || remoteJid);

    return {
      id: createMessageId(key.id || '', remoteJid, key.fromMe || false),
      body,
      type,
      timestamp: this.toTimestamp(msg.messageTimestamp) || Math.floor(Date.now() / 1000),
      from: toWwebjsJid(fromJid || remoteJid),
      to: toWwebjsJid(toJid || remoteJid),
      author: participant ? toWwebjsJid(participant) : undefined,
      isForwarded,
      forwardingScore,
      isStatus: remoteJid === 'status@broadcast',
      isStarred: msg.starred || false,
      broadcast: remoteJid.endsWith('@broadcast'),
      fromMe: key.fromMe || false,
      hasQuotedMsg,
      hasMedia,
      hasReaction: false,
      ack: this.mapStatusToAck(msg.status ?? undefined),
      mentionedIds,
      groupMentions: [],
      links,
      _data: msg,
    };
  }

  /**
   * Resolve a message key from a plain or serialized message ID
   */
  async resolveMessageKey(sessionId: string, chatId: string, messageId: string): Promise<WAMessageKey> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const chatJid = toBaileysJid(chatId);
    const parsed = this.parseSerializedMessageId(messageId);
    const rawId = parsed?.id || messageId;

    const candidates = new Set<string>();
    candidates.add(messageId);
    candidates.add(rawId);
    candidates.add(`${chatJid}_${rawId}`);

    for (const fromMe of [false, true]) {
      candidates.add(createMessageId(rawId, chatJid, fromMe)._serialized);
      candidates.add(`${fromMe}_${chatJid}_${rawId}`);
    }

    if (parsed?.remoteJid) {
      const parsedRemote = toBaileysJid(parsed.remoteJid);
      candidates.add(`${parsedRemote}_${rawId}`);
      for (const fromMe of [false, true]) {
        candidates.add(createMessageId(rawId, parsedRemote, fromMe)._serialized);
        candidates.add(`${fromMe}_${parsedRemote}_${rawId}`);
      }
    }

    for (const candidate of candidates) {
      const fromIndex = session.messageKeyIndex.get(candidate);
      if (fromIndex?.id) {
        const resolved: WAMessageKey = {
          ...fromIndex,
          remoteJid: fromIndex.remoteJid || chatJid,
        };
        this.registerMessageKey(sessionId, resolved);
        return resolved;
      }
    }

    const fromChatStore = session.store.messages[chatJid]?.get(rawId);
    if (fromChatStore?.key?.id) {
      this.registerMessageKey(sessionId, fromChatStore.key);
      return fromChatStore.key;
    }

    const loadedFromChat = await session.store.loadMessage(chatJid, rawId).catch(() => undefined);
    if (loadedFromChat?.key?.id) {
      this.registerMessageKey(sessionId, loadedFromChat.key);
      return loadedFromChat.key;
    }

    for (const [remoteJid, messages] of Object.entries(session.store.messages)) {
      const found = messages.get(rawId);
      if (found?.key?.id) {
        const key: WAMessageKey = {
          ...found.key,
          remoteJid: found.key.remoteJid || remoteJid,
        };
        this.registerMessageKey(sessionId, key);
        return key;
      }
    }

    throw new Error('Message not found in local store. Ensure it was synced or received after this session started.');
  }

  /**
   * Get a message object by ID
   */
  async getMessageById(sessionId: string, chatId: string, messageId: string): Promise<proto.IWebMessageInfo | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('Session not connected');
    }

    const key = await this.resolveMessageKey(sessionId, chatId, messageId);
    if (!key.id || !key.remoteJid) {
      return null;
    }

    const loaded = await session.store.loadMessage(key.remoteJid, key.id).catch(() => undefined);
    if (loaded) {
      return loaded;
    }

    return session.store.messages[key.remoteJid]?.get(key.id) || null;
  }

  /**
   * Get messages for a chat from local store (latest first)
   */
  getMessagesForChat(sessionId: string, chatId: string): proto.IWebMessageInfo[] {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      return [];
    }

    const jid = toBaileysJid(chatId);
    const entries = session.store.messages[jid]?.array || [];

    return [...entries].sort((a, b) => this.toTimestamp(b.messageTimestamp) - this.toTimestamp(a.messageTimestamp));
  }

  /**
   * Get last messages for a chat
   */
  getLastMessages(sessionId: string, chatId: string, count: number = 1): proto.IWebMessageInfo[] {
    return this.getMessagesForChat(sessionId, chatId).slice(0, Math.max(count, 0));
  }

  /**
   * Stop a session without clearing auth
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    logger.info({ sessionId }, 'Stopping session');

    this.stoppingSessions.add(sessionId);

    const pendingPersist = this.storePersistTimeouts.get(sessionId);
    if (pendingPersist) {
      clearTimeout(pendingPersist);
      this.storePersistTimeouts.delete(sessionId);
    }

    this.persistStore(sessionId);

    try {
      session.socket.end(undefined);
    } catch (error) {
      logger.warn({ sessionId, error }, 'Error ending socket');
    }

    this.sessions.delete(sessionId);

    setTimeout(() => {
      this.stoppingSessions.delete(sessionId);
    }, 5000);
  }

  /**
   * Terminate session and clear auth
   */
  async terminateSession(sessionId: string): Promise<void> {
    logger.info({ sessionId }, 'Terminating session');

    await this.stopSession(sessionId);

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
    if (!session) {
      return;
    }

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
    if (!session) {
      return null;
    }

    try {
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
    if (!session || session.status !== 'connected') {
      return [];
    }

    const chatsByJid = new Map<string, ChatData>();

    for (const chat of session.store.chats.all()) {
      if (!chat.id || chat.id === 'status@broadcast') {
        continue;
      }

      chatsByJid.set(chat.id, this.mapStoredChatToApi(sessionId, chat.id, chat, session.store.groupMetadata[chat.id]));
    }

    for (const [jid, metadata] of Object.entries(session.store.groupMetadata)) {
      if (jid === 'status@broadcast') {
        continue;
      }

      const current = chatsByJid.get(jid);
      chatsByJid.set(jid, this.mapStoredChatToApi(sessionId, jid, current ? this.getStoredChat(session, jid) : undefined, metadata));
    }

    for (const jid of Object.keys(session.store.messages)) {
      if (jid === 'status@broadcast' || chatsByJid.has(jid)) {
        continue;
      }

      chatsByJid.set(jid, this.mapStoredChatToApi(sessionId, jid));
    }

    try {
      const groups = await session.socket.groupFetchAllParticipating();
      for (const [jid, metadata] of Object.entries(groups)) {
        if (!chatsByJid.has(jid)) {
          chatsByJid.set(jid, this.mapStoredChatToApi(sessionId, jid, this.getStoredChat(session, jid), metadata));
        }
      }
    } catch (error) {
      logger.debug({ sessionId, error }, 'Unable to fetch all groups while listing chats');
    }

    return [...chatsByJid.values()].sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get chat by ID
   */
  async getChatById(sessionId: string, chatId: string): Promise<ChatData | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      return null;
    }

    const jid = toBaileysJid(chatId);

    try {
      const storedChat = this.getStoredChat(session, jid);

      if (isGroupJid(jid)) {
        let metadata = session.store.groupMetadata[jid];
        if (!metadata) {
          metadata = await session.socket.groupMetadata(jid);
          session.store.groupMetadata[jid] = metadata;
          this.scheduleStorePersist(sessionId);
        }

        return this.mapStoredChatToApi(sessionId, jid, storedChat, metadata);
      }

      return this.mapStoredChatToApi(sessionId, jid, storedChat);
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
    if (!session || session.status !== 'connected') {
      return [];
    }

    const blockedSet = await this.getBlockedSet(session);
    const contacts = new Map<string, ContactData>();

    for (const [jid, contact] of Object.entries(session.store.contacts)) {
      if (!jid || isGroupJid(jid) || jid === 'status@broadcast') {
        continue;
      }

      contacts.set(jid, this.mapStoredContactToApi(jid, contact, blockedSet));
    }

    for (const chat of session.store.chats.all()) {
      const jid = chat.id;
      if (!jid || isGroupJid(jid) || jid === 'status@broadcast' || contacts.has(jid)) {
        continue;
      }

      contacts.set(jid, this.mapStoredContactToApi(jid, session.store.contacts[jid], blockedSet));
    }

    for (const jid of Object.keys(session.store.messages)) {
      if (!jid || isGroupJid(jid) || jid === 'status@broadcast' || contacts.has(jid)) {
        continue;
      }

      contacts.set(jid, this.mapStoredContactToApi(jid, session.store.contacts[jid], blockedSet));
    }

    return [...contacts.values()].sort((a, b) => a.number.localeCompare(b.number));
  }

  /**
   * Get contact by ID
   */
  async getContactById(sessionId: string, contactId: string): Promise<ContactData | null> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      return null;
    }

    const jid = toBaileysJid(contactId);

    try {
      const blockedSet = await this.getBlockedSet(session);
      const contact = session.store.contacts[jid];

      if (!contact && !isGroupJid(jid)) {
        const [result] = (await session.socket.onWhatsApp(getPhoneNumber(jid))) || [];
        if (!result?.exists) {
          return null;
        }
      }

      return this.mapStoredContactToApi(jid, contact, blockedSet);
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
    if (!session || session.status !== 'connected') {
      return false;
    }

    const jid = toBaileysJid(contactId);

    try {
      const [result] = (await session.socket.onWhatsApp(getPhoneNumber(jid))) || [];
      return !!result?.exists;
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
    if (!session || !session.socket.user) {
      return null;
    }

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
    if (!session || session.status !== 'connected') {
      return null;
    }

    const jid = toBaileysJid(groupId);

    try {
      const metadata = session.store.groupMetadata[jid] || (await session.socket.groupMetadata(jid));
      session.store.groupMetadata[jid] = metadata;
      this.scheduleStorePersist(sessionId);

      return {
        id: createSerializedId(jid),
        owner: metadata.owner ? toWwebjsJid(metadata.owner) : '',
        subject: metadata.subject,
        creation: metadata.creation || 0,
        desc: metadata.desc || '',
        descId: metadata.descId || '',
        descOwner: metadata.descOwner ? toWwebjsJid(metadata.descOwner) : '',
        participants: metadata.participants.map((participant) => ({
          id: createSerializedId(participant.id),
          isAdmin: participant.admin === 'admin' || participant.admin === 'superadmin',
          isSuperAdmin: participant.admin === 'superadmin',
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
   * Get groups in common with a contact
   */
  async getCommonGroups(
    sessionId: string,
    contactId: string
  ): Promise<Array<{ id: { _serialized: string; user: string; server: string }; name: string }>> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      return [];
    }

    const contactJid = toBaileysJid(contactId);
    const metadataMap = { ...session.store.groupMetadata };

    try {
      const allGroups = await session.socket.groupFetchAllParticipating();
      Object.assign(metadataMap, allGroups);
    } catch (error) {
      logger.debug({ sessionId, contactId, error }, 'Unable to refresh group list for common groups');
    }

    const result: Array<{ id: { _serialized: string; user: string; server: string }; name: string }> = [];

    for (const [groupJid, metadata] of Object.entries(metadataMap)) {
      const isParticipant = metadata.participants.some((participant) => this.sameUser(participant.id, contactJid));
      if (!isParticipant) {
        continue;
      }

      result.push({
        id: createSerializedId(groupJid),
        name: metadata.subject || groupJid,
      });
    }

    return result;
  }

  /**
   * Get labels (business accounts only)
   */
  async getLabels(sessionId: string): Promise<LabelData[]> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      return [];
    }

    const labels = session.store.getLabels().findAll();

    return labels
      .map((label) => ({
        id: String((label as { id?: string }).id || ''),
        name: String((label as { name?: string }).name || ''),
        hexColor: String((label as { hexColor?: string }).hexColor || ''),
      }))
      .filter((label) => !!label.id);
  }

  /**
   * Auto-start existing sessions
   */
  async autoStartSessions(): Promise<void> {
    if (!config.autoStartSessions) {
      return;
    }

    logger.info('Auto-starting existing sessions');

    if (!fs.existsSync(config.sessionsPath)) {
      return;
    }

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

  private indexExistingMessages(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    for (const messages of Object.values(session.store.messages)) {
      for (const message of messages.array) {
        this.registerMessageKey(sessionId, message.key);
      }
    }
  }

  private registerMessageKey(sessionId: string, key?: WAMessageKey | null): void {
    if (!key?.id) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const keyAliases = new Set<string>();
    keyAliases.add(key.id);

    const remotes = [
      key.remoteJid,
      (key as WAMessageKey & { remoteJidAlt?: string }).remoteJidAlt,
    ].filter(Boolean) as string[];

    if (remotes.length === 0) {
      session.messageKeyIndex.set(key.id, key);
      return;
    }

    for (const remoteJid of remotes) {
      keyAliases.add(`${remoteJid}_${key.id}`);

      if (typeof key.fromMe === 'boolean') {
        keyAliases.add(createMessageId(key.id, remoteJid, key.fromMe)._serialized);
        keyAliases.add(`${key.fromMe}_${remoteJid}_${key.id}`);
      }

      keyAliases.add(createMessageId(key.id, remoteJid, true)._serialized);
      keyAliases.add(createMessageId(key.id, remoteJid, false)._serialized);
      keyAliases.add(`true_${remoteJid}_${key.id}`);
      keyAliases.add(`false_${remoteJid}_${key.id}`);
    }

    for (const alias of keyAliases) {
      session.messageKeyIndex.set(alias, key);
    }
  }

  private persistStore(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    try {
      fs.mkdirSync(path.dirname(session.storePath), { recursive: true });
      session.store.writeToFile(session.storePath);
    } catch (error) {
      logger.warn({ sessionId, error }, 'Failed to persist session store');
    }
  }

  private scheduleStorePersist(sessionId: string): void {
    const existingTimeout = this.storePersistTimeouts.get(sessionId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      this.persistStore(sessionId);
      this.storePersistTimeouts.delete(sessionId);
    }, 1200);

    this.storePersistTimeouts.set(sessionId, timeout);
  }

  private parseSerializedMessageId(
    messageId: string
  ): { fromMe: boolean; remoteJid: string; id: string } | null {
    const match = /^(true|false)_([^_]+)_(.+)$/.exec(messageId);
    if (!match) {
      return null;
    }

    return {
      fromMe: match[1] === 'true',
      remoteJid: match[2],
      id: match[3],
    };
  }

  private mapStoredChatToApi(
    sessionId: string,
    jid: string,
    chat?: proto.IConversation,
    groupMetadata?: {
      subject?: string;
      announce?: boolean;
      creation?: number;
    }
  ): ChatData {
    const session = this.sessions.get(sessionId);
    const isGroup = isGroupJid(jid);
    const lastMessage = this.getMostRecentMessage(sessionId, jid);

    const name =
      groupMetadata?.subject ||
      chat?.name ||
      session?.store.contacts[jid]?.name ||
      session?.store.contacts[jid]?.notify ||
      getPhoneNumber(jid);

    const chatExt = chat as
      | (proto.IConversation & {
          muteEndTime?: unknown;
          lastMsgTimestamp?: unknown;
          pin?: unknown;
          pinned?: unknown;
        })
      | undefined;

    const muteExpiration = this.toTimestamp(chatExt?.muteEndTime);
    const nowSeconds = Math.floor(Date.now() / 1000);

    const timestamp =
      this.toTimestamp(chat?.conversationTimestamp) ||
      this.toTimestamp(chatExt?.lastMsgTimestamp) ||
      groupMetadata?.creation ||
      lastMessage?.timestamp ||
      0;

    return {
      id: createSerializedId(jid),
      name,
      isGroup,
      isReadOnly: !!groupMetadata?.announce,
      unreadCount: Number(chat?.unreadCount || 0),
      timestamp,
      archived: !!chat?.archived,
      pinned: !!chatExt?.pin || !!chatExt?.pinned,
      isMuted: muteExpiration > nowSeconds,
      muteExpiration: muteExpiration > 0 ? muteExpiration : undefined,
      lastMessage,
    };
  }

  private mapStoredContactToApi(
    jid: string,
    contact: { name?: string; notify?: string; verifiedName?: string } | undefined,
    blockedSet: Set<string>
  ): ContactData {
    const number = getPhoneNumber(jid);
    const name = contact?.name || contact?.notify || contact?.verifiedName || number;

    return {
      id: createSerializedId(jid),
      number,
      name,
      shortName: name,
      pushname: contact?.notify || name,
      isUser: !isGroupJid(jid),
      isGroup: isGroupJid(jid),
      isWAContact: true,
      isMyContact: !!contact?.name,
      isBlocked: blockedSet.has(jid),
    };
  }

  private getMostRecentMessage(sessionId: string, chatJid: string): MessageData | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }

    const messages = session.store.messages[chatJid]?.array;
    if (!messages || messages.length === 0) {
      return undefined;
    }

    let latest = messages[0];
    let latestTimestamp = this.toTimestamp(latest.messageTimestamp);

    for (const message of messages) {
      const timestamp = this.toTimestamp(message.messageTimestamp);
      if (timestamp > latestTimestamp) {
        latest = message;
        latestTimestamp = timestamp;
      }
    }

    return this.formatMessage(latest, sessionId);
  }

  private getStoredChat(session: BaileysSession, jid: string): proto.IConversation | undefined {
    try {
      return session.store.chats.get(jid);
    } catch {
      return undefined;
    }
  }

  private async getBlockedSet(session: BaileysSession): Promise<Set<string>> {
    try {
      const blocklist = await session.socket.fetchBlocklist();
      return new Set(blocklist);
    } catch {
      return new Set();
    }
  }

  private sameUser(a?: string, b?: string): boolean {
    if (!a || !b) {
      return false;
    }

    if (a === b) {
      return true;
    }

    const wa = toWwebjsJid(a);
    const wb = toWwebjsJid(b);
    if (wa === wb) {
      return true;
    }

    const na = getPhoneNumber(a);
    const nb = getPhoneNumber(b);
    return na.length > 0 && na === nb;
  }

  private toTimestamp(value: unknown): number {
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
}

export const sessionManager = new SessionManager();
export default sessionManager;
