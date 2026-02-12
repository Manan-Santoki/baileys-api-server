declare module 'ws' {
  import type { IncomingMessage } from 'http';

  export class WebSocket {
    static OPEN: number;
    readyState: number;
    send(data: string): void;
    close(code?: number, reason?: string): void;
    on(event: 'message', listener: (data: Buffer | string) => void): this;
    on(event: 'close', listener: () => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
  }

  export class WebSocketServer {
    constructor(options: { server: unknown; path?: string });
    on(event: 'connection', listener: (socket: WebSocket, req: IncomingMessage) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    close(): void;
  }
}
