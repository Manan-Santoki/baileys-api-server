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
ENABLE_WEBSOCKET=true
ENABLE_WEBHOOK=true
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

### System
- `GET /ping` - Health check
- `GET /ws` - WebSocket upgrade endpoint for realtime events (when enabled)

### Session Management
- `GET /session/start/:sessionId` - Start session
- `GET /session/stop/:sessionId` - Stop session (keep auth)
- `GET /session/status/:sessionId` - Get session status
- `DELETE /session/terminate/:sessionId` - Terminate session and delete auth
- `GET /session/getSessions` - List in-memory sessions
- `GET /session/qr/:sessionId` - Get QR text
- `GET /session/qr/:sessionId/image` - Get QR PNG image
- `POST /session/requestPairingCode/:sessionId` - Request phone pairing code
- `GET /session/logout/:sessionId` - Logout session
- `GET /session/restart/:sessionId` - Restart session

### Client Operations
- `POST /client/sendMessage/:sessionId` - Send message
- `POST /client/getChats/:sessionId` - Get chats
- `POST /client/getChatById/:sessionId` - Get chat by id
- `POST /client/getContacts/:sessionId` - Get contacts
- `POST /client/getContactById/:sessionId` - Get contact by id
- `POST /client/isRegisteredUser/:sessionId` - Check if number is on WhatsApp
- `POST /client/getInfo/:sessionId` - Get client info
- `POST /client/getLabels/:sessionId` - Get labels
- `POST /client/createGroup/:sessionId` - Create group
- `POST /client/getProfilePicUrl/:sessionId` - Get profile picture URL
- `POST /client/getBlockedContacts/:sessionId` - Get blocked contacts
- `POST /client/blockContact/:sessionId` - Block contact
- `POST /client/unblockContact/:sessionId` - Unblock contact
- `POST /client/setStatus/:sessionId` - Set profile status
- `POST /client/setDisplayName/:sessionId` - Set display name
- `POST /client/getCommonGroups/:sessionId` - Get common groups with contact
- `POST /client/getNumberId/:sessionId` - Resolve number id/JID
- `POST /client/sendPresenceUpdate/:sessionId` - Send account presence state

### Chat Operations
- `POST /chat/fetchMessages/:sessionId` - Fetch stored messages
- `POST /chat/sendStateTyping/:sessionId` - Send typing state
- `POST /chat/clearState/:sessionId` - Clear typing/recording state
- `POST /chat/sendStateRecording/:sessionId` - Send recording state
- `POST /chat/sendSeen/:sessionId` - Mark chat seen
- `POST /chat/markUnread/:sessionId` - Mark chat unread
- `POST /chat/archive/:sessionId` - Archive chat
- `POST /chat/unarchive/:sessionId` - Unarchive chat
- `POST /chat/pin/:sessionId` - Pin chat
- `POST /chat/unpin/:sessionId` - Unpin chat
- `POST /chat/mute/:sessionId` - Mute chat
- `POST /chat/unmute/:sessionId` - Unmute chat
- `POST /chat/clearMessages/:sessionId` - Clear local chat messages
- `POST /chat/delete/:sessionId` - Delete chat
- `POST /chat/getLabels/:sessionId` - Get chat labels
- `POST /chat/getContact/:sessionId` - Get chat contact

### Contact Operations
- `POST /contact/getAbout/:sessionId` - Get contact about/status
- `POST /contact/getProfilePicUrl/:sessionId` - Get contact profile picture URL
- `POST /contact/block/:sessionId` - Block contact
- `POST /contact/unblock/:sessionId` - Unblock contact
- `POST /contact/isBlocked/:sessionId` - Check if contact is blocked
- `POST /contact/getCommonGroups/:sessionId` - Get common groups
- `POST /contact/getFormattedNumber/:sessionId` - Get formatted number
- `POST /contact/getCountryCode/:sessionId` - Get country code

### Group Chat Operations
- `POST /groupChat/getGroupInfo/:sessionId` - Get group metadata
- `POST /groupChat/getParticipants/:sessionId` - Get participants
- `POST /groupChat/addParticipants/:sessionId` - Add participants
- `POST /groupChat/removeParticipants/:sessionId` - Remove participants
- `POST /groupChat/promoteParticipants/:sessionId` - Promote participants
- `POST /groupChat/demoteParticipants/:sessionId` - Demote participants
- `POST /groupChat/setSubject/:sessionId` - Set group subject
- `POST /groupChat/setDescription/:sessionId` - Set group description
- `POST /groupChat/setMessagesAdminsOnly/:sessionId` - Toggle admin-only messaging
- `POST /groupChat/setInfoAdminsOnly/:sessionId` - Toggle admin-only info editing
- `POST /groupChat/leave/:sessionId` - Leave group
- `POST /groupChat/getInviteCode/:sessionId` - Get invite code
- `POST /groupChat/revokeInvite/:sessionId` - Revoke invite code
- `POST /groupChat/acceptInvite/:sessionId` - Accept invite code
- `POST /groupChat/getInviteInfo/:sessionId` - Get invite metadata
- `POST /groupChat/setPicture/:sessionId` - Set group picture
- `POST /groupChat/deletePicture/:sessionId` - Delete group picture

### Message Operations
- `POST /message/getInfo/:sessionId` - Get message receipts info
- `POST /message/react/:sessionId` - React to message
- `POST /message/star/:sessionId` - Star or unstar message
- `POST /message/delete/:sessionId` - Delete message
- `POST /message/forward/:sessionId` - Forward message
- `POST /message/downloadMedia/:sessionId` - Download media from message
- `POST /message/getQuotedMessage/:sessionId` - Get quoted message
- `POST /message/getMentions/:sessionId` - Get message mentions
- `POST /message/edit/:sessionId` - Edit message
- `POST /message/pin/:sessionId` - Pin message
- `POST /message/unpin/:sessionId` - Unpin message

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

- Set `ENABLE_WEBHOOK=false` to disable outbound HTTP webhook delivery.

### Event Types
- `qr` - QR code generated
- `ready` - Session connected
- `authenticated` - Authentication successful
- `auth_failure` - Authentication failed
- `disconnected` - Session disconnected
- `message` - Incoming message (not from self)
- `message_create` - Any message (including sent)
- `message_ack` - Message delivery/read status
- `message_revoke_everyone` - Message revoked for everyone
- `message_reaction` - Reaction to message
- `group_join` - Participant joined group
- `group_leave` - Participant left group
- `group_update` - Group settings changed
- `call` - Incoming call
- `change_state` - Client state changed
- `loading_screen` - Loading/sync progress update
- `contact_changed` - Contact JID/identity changed
- `chat_removed` - Chat deleted/removed
- `chat_archived` - Chat archive state changed
- `unread_count` - Chat unread count updated
- `media_uploaded` - Media upload event
- `remote_session_saved` - Remote session persisted

## WebSocket Events

Connect to:
`ws://<host>:<port>/ws?apiKey=<API_KEY>&sessionId=<optionalSessionId>`

- Set `ENABLE_WEBSOCKET=false` to disable websocket server startup.
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
