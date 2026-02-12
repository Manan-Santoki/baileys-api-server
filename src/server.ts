import { createServer } from 'http';
import app from './app';
import config from './config';
import logger from './logger';
import sessionManager from './services/SessionManager';
import webSocketService from './services/WebSocketService';

async function main() {
  logger.info('Starting Baileys API Server...');
  logger.info({
    port: config.port,
    sessionsPath: config.sessionsPath,
    autoStartSessions: config.autoStartSessions,
    webSocketEnabled: config.enableWebSocket,
    webhookEnabled: config.enableWebhook,
    webhookUrl: config.baseWebhookUrl || '(not configured)',
  }, 'Configuration');

  // Auto-start existing sessions if enabled
  if (config.autoStartSessions) {
    await sessionManager.autoStartSessions();
  }

  // Start HTTP server (+ websocket server if enabled)
  const server = createServer(app);
  if (config.enableWebSocket) {
    webSocketService.initialize(server);
  }

  server.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    if (config.enableWebSocket) {
      logger.info(`WebSocket endpoint ws://localhost:${config.port}/ws`);
    } else {
      logger.info('WebSocket endpoint disabled (ENABLE_WEBSOCKET=false)');
    }
    logger.info('Available endpoints:');
    logger.info('  GET  /ping - Health check');
    logger.info('  GET  /session/start/:sessionId - Start session');
    logger.info('  GET  /session/status/:sessionId - Get session status');
    logger.info('  GET  /session/qr/:sessionId - Get QR code');
    logger.info('  POST /client/sendMessage/:sessionId - Send message');
    logger.info('  ... and more. See routes/index.ts for full list');
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down...');
  const sessionIds = sessionManager.getAllSessionIds();
  for (const sessionId of sessionIds) {
    await sessionManager.stopSession(sessionId);
  }
  webSocketService.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down...');
  const sessionIds = sessionManager.getAllSessionIds();
  for (const sessionId of sessionIds) {
    await sessionManager.stopSession(sessionId);
  }
  webSocketService.close();
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logger.error({ error: error.message, stack: error.stack }, 'Unhandled rejection');
});

main().catch((error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Failed to start server');
  process.exit(1);
});
