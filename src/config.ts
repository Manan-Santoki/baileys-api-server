import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  apiKey: process.env.API_KEY || '',
  baseWebhookUrl: process.env.BASE_WEBHOOK_URL || '',
  sessionsPath: process.env.SESSIONS_PATH || './sessions',
  autoStartSessions: process.env.AUTO_START_SESSIONS === 'true',
  logLevel: process.env.LOG_LEVEL || 'info',
  disabledCallbacks: (process.env.DISABLED_CALLBACKS || '').split(',').filter(Boolean),
  maxReconnectRetries: parseInt(process.env.MAX_RECONNECT_RETRIES || '5', 10),
  reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || '3000', 10),
};

export function getSessionPath(sessionId: string): string {
  return path.join(config.sessionsPath, `session-${sessionId}`);
}

export default config;
