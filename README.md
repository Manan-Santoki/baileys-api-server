# Baileys API Server

A lightweight WhatsApp API server using [Baileys](https://github.com/WhiskeySockets/Baileys) - a drop-in replacement for wwebjs-api with ~500MB less RAM usage per session.

## Features

- WebSocket-based connection (no browser/Puppeteer required)
- Full API parity with wwebjs-api (~70+ endpoints)
- QR code and pairing code authentication
- Webhook delivery for events
- WebSocket event stream at `/ws` (session-filterable)
- Multi-session support
- Auto-reconnection with exponential backoff
- OpenAPI + Swagger docs at `/openapi.json` and `/docs`

## Installation

```bash
cd baileys-api-server
bun install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
PORT=3000
API_KEY=your_api_key_here
BASE_WEBHOOK_URL=http://localhost:3001/api/ai-agents/webhook
SESSIONS_PATH=./sessions
AUTO_START_SESSIONS=true
LOG_LEVEL=info
```

## Running

Development with hot-reload:
```bash
bun run dev
```

Production:
```bash
bun run start
```

## API Endpoints

Interactive docs:
- `GET /docs` - Swagger UI
- `GET /openapi.json` - OpenAPI schema

### Health Check
- `GET /ping` - Health check

### Session Management
- `GET /session/start/:sessionId` - Start a new session
- `GET /session/stop/:sessionId` - Stop session (keep auth)
- `GET /session/status/:sessionId` - Get session status
- `DELETE /session/terminate/:sessionId` - Terminate and delete auth
- `GET /session/getSessions` - List all sessions
- `GET /session/qr/:sessionId` - Get QR code (text)
- `GET /session/qr/:sessionId/image` - Get QR code (PNG image)
- `POST /session/requestPairingCode/:sessionId` - Request pairing code

### Client Operations
- `POST /client/sendMessage/:sessionId` - Send message
- `POST /client/getChats/:sessionId` - Get all chats
- `POST /client/getChatById/:sessionId` - Get chat by ID
- `POST /client/getContacts/:sessionId` - Get all contacts
- `POST /client/getContactById/:sessionId` - Get contact by ID
- `POST /client/isRegisteredUser/:sessionId` - Check WhatsApp registration
- `POST /client/createGroup/:sessionId` - Create group
- `POST /client/getLabels/:sessionId` - Get labels (business)

### Chat Operations
- `POST /chat/fetchMessages/:sessionId` - Fetch message history
- `POST /chat/sendStateTyping/:sessionId` - Send typing indicator
- `POST /chat/sendSeen/:sessionId` - Mark as read
- `POST /chat/archive/:sessionId` - Archive chat
- `POST /chat/pin/:sessionId` - Pin chat
- `POST /chat/mute/:sessionId` - Mute chat

### Group Chat Operations
- `POST /groupChat/getGroupInfo/:sessionId` - Get group metadata
- `POST /groupChat/addParticipants/:sessionId` - Add participants
- `POST /groupChat/removeParticipants/:sessionId` - Remove participants
- `POST /groupChat/promoteParticipants/:sessionId` - Promote to admin
- `POST /groupChat/setSubject/:sessionId` - Set group name
- `POST /groupChat/leave/:sessionId` - Leave group

### Message Operations
- `POST /message/react/:sessionId` - React to message
- `POST /message/delete/:sessionId` - Delete message
- `POST /message/edit/:sessionId` - Edit message

## Sending Messages

### Text Message
```json
POST /client/sendMessage/:sessionId
{
  "chatId": "1234567890@c.us",
  "contentType": "string",
  "content": "Hello World!"
}
```

### Media Message
```json
POST /client/sendMessage/:sessionId
{
  "chatId": "1234567890@c.us",
  "contentType": "MessageMedia",
  "content": {
    "mimetype": "image/png",
    "data": "base64_encoded_data",
    "filename": "image.png"
  },
  "options": {
    "caption": "Check this out!"
  }
}
```

### Media from URL
```json
POST /client/sendMessage/:sessionId
{
  "chatId": "1234567890@c.us",
  "contentType": "MessageMediaFromURL",
  "content": "https://example.com/image.png",
  "options": {
    "caption": "From URL"
  }
}
```

## Webhook Events

Events are delivered to `BASE_WEBHOOK_URL` with format:
```json
{
  "sessionId": "session1",
  "dataType": "message_create",
  "data": { ... }
}
```

### Event Types
- `qr` - QR code generated
- `ready` - Session connected
- `authenticated` - Authentication successful
- `disconnected` - Session disconnected
- `message` - Incoming message (not from self)
- `message_create` - Any message (including sent)
- `message_ack` - Message delivery/read status
- `message_reaction` - Reaction to message
- `group_join` - Participant joined group
- `group_leave` - Participant left group
- `group_update` - Group settings changed
- `call` - Incoming call

## WebSocket Events

Connect to:
`ws://<host>:<port>/ws?apiKey=<API_KEY>&sessionId=<optionalSessionId>`

- If `sessionId` is provided, only that session's events are streamed
- If omitted, all session events are streamed
- Message format:
```json
{
  "sessionId": "session1",
  "dataType": "message_create",
  "data": { "...": "..." },
  "timestamp": "2026-02-12T10:20:30.000Z"
}
```

## Differences from wwebjs-api

### JID Format
- wwebjs uses `@c.us` for contacts: `1234567890@c.us`
- Baileys uses `@s.whatsapp.net`: `1234567890@s.whatsapp.net`
- The API automatically converts between formats

### Limitations
1. **Message History**: Message history is store-backed for synced and live messages. Full historical backfill beyond what the linked device syncs still depends on WhatsApp history sync.
2. **Contact List**: Contact listing is store-backed from sync/live updates; unknown contacts are discovered progressively.
3. **Labels**: Limited support for WhatsApp Business labels.
4. **Some metadata retrieval**: Certain WhatsApp internals (e.g. deep business metadata) remain protocol-limited.

### Advantages
1. **Memory**: ~500MB less RAM per session (no Chrome/Puppeteer)
2. **Speed**: Faster connection and message sending
3. **Stability**: No browser crashes or memory leaks
4. **Resources**: Lower CPU usage

## License

MIT
