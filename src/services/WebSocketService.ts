import type { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';

import config from '../config';
import logger from '../logger';

interface EventPayload {
  sessionId: string;
  dataType: string;
  data: unknown;
  timestamp: string;
}

interface ClientContext {
  socket: WebSocket;
  sessionId?: string;
}

class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientContext> = new Set();

  initialize(server: HttpServer): void {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({
      server,
      path: '/ws',
    });

    this.wss.on('connection', (socket: WebSocket, req: IncomingMessage) => {
      if (!this.isAuthorized(req)) {
        socket.close(1008, 'Unauthorized');
        return;
      }

      const sessionId = this.getQueryParam(req, 'sessionId') || undefined;
      const client: ClientContext = {
        socket,
        sessionId,
      };

      this.clients.add(client);

      socket.on('message', (raw: Buffer | string) => {
        const text = raw.toString();
        if (text === 'ping') {
          socket.send('pong');
        }
      });

      socket.on('close', () => {
        this.clients.delete(client);
      });

      socket.on('error', (error: Error) => {
        logger.debug({ error: error.message }, 'WebSocket client error');
      });

      socket.send(
        JSON.stringify({
          type: 'connected',
          sessionId: sessionId || null,
          timestamp: new Date().toISOString(),
        })
      );
    });

    this.wss.on('error', (error: Error) => {
      logger.error({ error: error.message }, 'WebSocket server error');
    });

    logger.info('WebSocket server ready at /ws');
  }

  broadcast(sessionId: string, dataType: string, data: unknown): void {
    const payload: EventPayload = {
      sessionId,
      dataType,
      data,
      timestamp: new Date().toISOString(),
    };

    const encoded = JSON.stringify(payload);

    for (const client of this.clients) {
      if (client.socket.readyState !== WebSocket.OPEN) {
        continue;
      }

      if (client.sessionId && client.sessionId !== sessionId) {
        continue;
      }

      try {
        client.socket.send(encoded);
      } catch (error) {
        logger.debug({ error }, 'Failed to send websocket payload');
      }
    }
  }

  close(): void {
    if (!this.wss) {
      return;
    }

    for (const client of this.clients) {
      try {
        client.socket.close(1001, 'Server shutting down');
      } catch {
        // ignore close errors
      }
    }

    this.clients.clear();
    this.wss.close();
    this.wss = null;
  }

  private isAuthorized(req: IncomingMessage): boolean {
    if (!config.apiKey) {
      return true;
    }

    const headerKey = req.headers['x-api-key'];
    if (typeof headerKey === 'string' && headerKey === config.apiKey) {
      return true;
    }

    const queryKey = this.getQueryParam(req, 'apiKey');
    return queryKey === config.apiKey;
  }

  private getQueryParam(req: IncomingMessage, name: string): string | null {
    if (!req.url) {
      return null;
    }

    try {
      const parsed = new URL(req.url, 'http://localhost');
      return parsed.searchParams.get(name);
    } catch {
      return null;
    }
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService;
