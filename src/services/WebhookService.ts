import axios from 'axios';
import config from '../config';
import logger from '../logger';
import type { WebhookPayload } from '../types';

class WebhookService {
  private baseUrl: string;
  private apiKey: string;
  private disabledCallbacks: Set<string>;

  constructor() {
    this.baseUrl = config.baseWebhookUrl;
    this.apiKey = config.apiKey;
    this.disabledCallbacks = new Set(config.disabledCallbacks);
  }

  /**
   * Check if a callback type is enabled
   */
  isCallbackEnabled(dataType: string): boolean {
    return !this.disabledCallbacks.has(dataType);
  }

  /**
   * Send webhook to the configured URL
   */
  async send(sessionId: string, dataType: string, data: unknown): Promise<void> {
    if (!this.baseUrl) {
      logger.debug({ sessionId, dataType }, 'No webhook URL configured, skipping');
      return;
    }

    if (!this.isCallbackEnabled(dataType)) {
      logger.debug({ sessionId, dataType }, 'Callback disabled, skipping webhook');
      return;
    }

    const payload: WebhookPayload = {
      sessionId,
      dataType,
      data,
    };

    try {
      logger.debug({ sessionId, dataType, url: this.baseUrl }, 'Sending webhook');

      await axios.post(this.baseUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
        },
        timeout: 30000,
      });

      logger.info({ sessionId, dataType }, 'Webhook delivered successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { sessionId, dataType, error: errorMessage, url: this.baseUrl },
        'Failed to deliver webhook'
      );
    }
  }

  /**
   * Send QR code webhook
   */
  async sendQr(sessionId: string, qr: string): Promise<void> {
    await this.send(sessionId, 'qr', { qr });
  }

  /**
   * Send ready webhook
   */
  async sendReady(sessionId: string, info: unknown): Promise<void> {
    await this.send(sessionId, 'ready', info);
  }

  /**
   * Send disconnected webhook
   */
  async sendDisconnected(sessionId: string, reason?: string): Promise<void> {
    await this.send(sessionId, 'disconnected', { reason });
  }

  /**
   * Send authenticated webhook
   */
  async sendAuthenticated(sessionId: string): Promise<void> {
    await this.send(sessionId, 'authenticated', {});
  }

  /**
   * Send auth failure webhook
   */
  async sendAuthFailure(sessionId: string, error: string): Promise<void> {
    await this.send(sessionId, 'auth_failure', { message: error });
  }

  /**
   * Send message webhook
   */
  async sendMessage(sessionId: string, message: unknown): Promise<void> {
    await this.send(sessionId, 'message', message);
  }

  /**
   * Send message create webhook
   */
  async sendMessageCreate(sessionId: string, message: unknown): Promise<void> {
    await this.send(sessionId, 'message_create', message);
  }

  /**
   * Send message ack webhook
   */
  async sendMessageAck(sessionId: string, message: unknown, ack: number): Promise<void> {
    await this.send(sessionId, 'message_ack', { message, ack });
  }

  /**
   * Send message revoke webhook
   */
  async sendMessageRevoke(sessionId: string, message: unknown, revokedMsg: unknown): Promise<void> {
    await this.send(sessionId, 'message_revoke_everyone', { message, revokedMsg });
  }

  /**
   * Send message reaction webhook
   */
  async sendMessageReaction(sessionId: string, reaction: unknown): Promise<void> {
    await this.send(sessionId, 'message_reaction', reaction);
  }

  /**
   * Send group join webhook
   */
  async sendGroupJoin(sessionId: string, notification: unknown): Promise<void> {
    await this.send(sessionId, 'group_join', notification);
  }

  /**
   * Send group leave webhook
   */
  async sendGroupLeave(sessionId: string, notification: unknown): Promise<void> {
    await this.send(sessionId, 'group_leave', notification);
  }

  /**
   * Send group update webhook
   */
  async sendGroupUpdate(sessionId: string, notification: unknown): Promise<void> {
    await this.send(sessionId, 'group_update', notification);
  }

  /**
   * Send call webhook
   */
  async sendCall(sessionId: string, call: unknown): Promise<void> {
    await this.send(sessionId, 'call', call);
  }

  /**
   * Send state change webhook
   */
  async sendStateChange(sessionId: string, state: string): Promise<void> {
    await this.send(sessionId, 'change_state', { state });
  }

  /**
   * Send loading screen webhook
   */
  async sendLoadingScreen(sessionId: string, percent: number, message: string): Promise<void> {
    await this.send(sessionId, 'loading_screen', { percent, message });
  }

  /**
   * Send contact changed webhook
   */
  async sendContactChanged(sessionId: string, message: unknown, oldId: string, newId: string): Promise<void> {
    await this.send(sessionId, 'contact_changed', { message, oldId, newId });
  }

  /**
   * Send chat removed webhook
   */
  async sendChatRemoved(sessionId: string, chat: unknown): Promise<void> {
    await this.send(sessionId, 'chat_removed', chat);
  }

  /**
   * Send chat archived webhook
   */
  async sendChatArchived(sessionId: string, chat: unknown, archived: boolean): Promise<void> {
    await this.send(sessionId, 'chat_archived', { chat, archived });
  }

  /**
   * Send unread count webhook
   */
  async sendUnreadCount(sessionId: string, chat: unknown): Promise<void> {
    await this.send(sessionId, 'unread_count', chat);
  }

  /**
   * Send media uploaded webhook
   */
  async sendMediaUploaded(sessionId: string, message: unknown): Promise<void> {
    await this.send(sessionId, 'media_uploaded', message);
  }

  /**
   * Send remote session saved webhook
   */
  async sendRemoteSessionSaved(sessionId: string): Promise<void> {
    await this.send(sessionId, 'remote_session_saved', {});
  }
}

export const webhookService = new WebhookService();
export default webhookService;
