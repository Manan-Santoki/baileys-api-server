import type { WASocket, proto, WAMessageKey, makeInMemoryStore } from '@whiskeysockets/baileys';

export type SessionStatus = 'connecting' | 'qr' | 'connected' | 'disconnected' | 'pairing';

export interface BaileysSession {
  socket: WASocket;
  store: ReturnType<typeof makeInMemoryStore>;
  storePath: string;
  messageKeyIndex: Map<string, WAMessageKey>;
  qr: string | null;
  pairingCode: string | null;
  status: SessionStatus;
  saveCreds: () => Promise<void>;
  reconnectAttempts: number;
  phoneNumber?: string;
}

export interface WebhookPayload {
  sessionId: string;
  dataType: string;
  data: unknown;
}

export interface SendMessageOptions {
  chatId: string;
  contentType: 'string' | 'MessageMedia' | 'MessageMediaFromURL' | 'Location' | 'Poll' | 'Contact' | 'Buttons' | 'List';
  content: string | MediaContent | LocationContent | PollContent | ContactContent | ButtonsContent | ListContent;
  options?: {
    quotedMessageId?: string;
    mentions?: string[];
    sendAudioAsVoice?: boolean;
    sendVideoAsGif?: boolean;
    caption?: string;
    linkPreview?: boolean;
  };
}

export interface MediaContent {
  mimetype: string;
  data: string;
  filename?: string;
  filesize?: number;
}

export interface LocationContent {
  latitude: number;
  longitude: number;
  description?: string;
}

export interface PollContent {
  pollName: string;
  pollOptions: string[];
  options?: {
    allowMultipleAnswers?: boolean;
  };
}

export interface ContactContent {
  contactId: string;
}

export interface ButtonsContent {
  body: string;
  buttons: Array<{ id: string; body: string }>;
  title?: string;
  footer?: string;
}

export interface ListContent {
  body: string;
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>;
  title?: string;
  footer?: string;
}

export interface ChatData {
  id: { _serialized: string; user: string; server: string };
  name: string;
  isGroup: boolean;
  isReadOnly: boolean;
  unreadCount: number;
  timestamp: number;
  archived: boolean;
  pinned: boolean;
  isMuted: boolean;
  muteExpiration?: number;
  lastMessage?: MessageData;
}

export interface ContactData {
  id: { _serialized: string; user: string; server: string };
  number: string;
  name: string;
  shortName: string;
  pushname: string;
  isUser: boolean;
  isGroup: boolean;
  isWAContact: boolean;
  isMyContact: boolean;
  isBlocked: boolean;
}

export interface MessageData {
  id: { _serialized: string; fromMe: boolean; remote: string; id: string };
  body: string;
  type: string;
  timestamp: number;
  from: string;
  to: string;
  author?: string;
  isForwarded: boolean;
  forwardingScore: number;
  isStatus: boolean;
  isStarred: boolean;
  broadcast: boolean;
  fromMe: boolean;
  hasQuotedMsg: boolean;
  hasMedia: boolean;
  hasReaction: boolean;
  ack: number;
  mentionedIds: string[];
  groupMentions: string[];
  links: Array<{ link: string; isSuspicious: boolean }>;
  _data?: unknown;
}

export interface GroupMetadata {
  id: { _serialized: string };
  owner: string;
  subject: string;
  creation: number;
  desc: string;
  descId: string;
  descOwner: string;
  participants: Array<{
    id: { _serialized: string };
    isAdmin: boolean;
    isSuperAdmin: boolean;
  }>;
  announce: boolean;
  restrict: boolean;
  size: number;
}

export interface LabelData {
  id: string;
  name: string;
  hexColor: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  [key: string]: unknown;
}
