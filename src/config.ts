import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKey: process.env.API_KEY || '',
  enableLegacyRouter: parseBooleanEnv(process.env.ENABLE_LEGACY_ROUTER, true),
  enableWebSocket: parseBooleanEnv(process.env.ENABLE_WEBSOCKET, true),
  enableWebhook: parseBooleanEnv(process.env.ENABLE_WEBHOOK, true),
  baseWebhookUrl: process.env.BASE_WEBHOOK_URL || '',
  sessionsPath: process.env.SESSIONS_PATH || './sessions',
  autoStartSessions: parseBooleanEnv(process.env.AUTO_START_SESSIONS, false),
  logLevel: process.env.LOG_LEVEL || 'info',
  disabledCallbacks: (process.env.DISABLED_CALLBACKS || '').split(',').filter(Boolean),
  maxReconnectRetries: parseInt(process.env.MAX_RECONNECT_RETRIES || '5', 10),
  reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || '3000', 10),
};

export function getSessionPath(sessionId: string): string {
  return path.join(config.sessionsPath, `session-${sessionId}`);
}

export default config;
