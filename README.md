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

## Sending Messages Guide

All sending uses:
- `POST /client/sendMessage/:sessionId`
- Header: `x-api-key: <API_KEY>` (if configured)
- Body required keys: `chatId`, `contentType`, `content`

### chatId formats you can use
- `1234567890@c.us` (wwebjs contact format)
- `1234567890@s.whatsapp.net` (Baileys contact format)
- `1234567890` (server auto-converts to WhatsApp user JID)
- `1203630XXXXXXXXX@g.us` (group JID)

Use the same endpoint for personal and group chats. Group sends require the session account to be a participant and allowed to send messages in that group.

### contentType support
- `string`: plain text message
- `MessageMedia`: base64 media payload
- `MessageMediaFromURL`: media from public URL
- `Location`: latitude/longitude location message
- `Poll`: poll message
- `Contact`: send a contact card
- `Buttons`: fallback text rendering (interactive buttons are deprecated by WhatsApp)
- `List`: fallback text rendering (interactive lists are deprecated by WhatsApp)

### options support
`options` is optional and currently supports:
- `caption`: media caption
- `quotedMessageId`: reply to an existing message id
- `mentions`: array of user IDs to mention
- `sendAudioAsVoice`: send audio as voice note (`ptt`)
- `sendVideoAsGif`: send video as GIF playback
- `linkPreview`: enable/disable text link preview generation (default: enabled)

### Option applicability matrix (important)
Not all options apply to all `contentType` values.

| Option | string | MessageMedia | MessageMediaFromURL | Location | Poll | Contact | Buttons | List |
|---|---|---|---|---|---|---|---|---|
| `quotedMessageId` | Yes | Yes | Yes | No | No | No | No | No |
| `mentions` | Yes | Yes | Yes | No | No | No | No | No |
| `caption` | No | Image/Video only | Image/Video only | No | No | No | No | No |
| `sendAudioAsVoice` | No | Audio only | Audio URL only | No | No | No | No | No |
| `sendVideoAsGif` | No | Video only | Video URL only | No | No | No | No | No |
| `linkPreview` | Yes | No | No | No | No | No | No | No |

Implementation details:
- `quotedMessageId` is best-effort. If message is not found in local store, send still succeeds without quote.
- `linkPreview` only applies to text messages and only the first `http/https` URL in text is used.
- Link preview generation has a `5s` timeout and failures are non-blocking (message is still sent).
- `MessageMediaFromURL` first downloads media server-side (`60s` timeout), then sends it as normal media.
- If `caption` is not provided for image/video, server falls back to `filename`, then empty string.
- Audio/document messages ignore `caption` in current implementation.

### 1) Plain text
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "string",
  "content": "Hello from API"
}
```

### 2) Text with mentions + quote + link preview control
```json
{
  "chatId": "120363012345678901@g.us",
  "contentType": "string",
  "content": "Hi @user, please review this: https://example.com/spec",
  "options": {
    "mentions": ["1234567890@c.us"],
    "quotedMessageId": "ABCD1234EFGH5678",
    "linkPreview": false
  }
}
```

Note:
- `quotedMessageId` should exist in local message store for that session/chat. If not found, message is still sent without quote context.
- `mentions` accepts IDs in `@c.us`, `@s.whatsapp.net`, or numeric form.

### 3) Image via base64
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "MessageMedia",
  "content": {
    "mimetype": "image/jpeg",
    "data": "<BASE64_IMAGE>",
    "filename": "photo.jpg"
  },
  "options": {
    "caption": "Image from base64"
  }
}
```

### 4) Video via base64 (normal or GIF playback)
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "MessageMedia",
  "content": {
    "mimetype": "video/mp4",
    "data": "<BASE64_VIDEO>",
    "filename": "clip.mp4"
  },
  "options": {
    "caption": "Video clip",
    "sendVideoAsGif": true
  }
}
```

### 5) Audio via base64 (normal audio or voice note)
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "MessageMedia",
  "content": {
    "mimetype": "audio/ogg",
    "data": "<BASE64_AUDIO>",
    "filename": "note.ogg"
  },
  "options": {
    "sendAudioAsVoice": true
  }
}
```

### 6) Document via base64
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "MessageMedia",
  "content": {
    "mimetype": "application/pdf",
    "data": "<BASE64_PDF>",
    "filename": "invoice.pdf"
  }
}
```

### 7) Media from URL
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "MessageMediaFromURL",
  "content": "https://example.com/path/image.png",
  "options": {
    "caption": "Fetched from URL"
  }
}
```

### 8) Location message
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "Location",
  "content": {
    "latitude": 37.7749,
    "longitude": -122.4194,
    "description": "San Francisco"
  }
}
```

### 9) Poll message
```json
{
  "chatId": "120363012345678901@g.us",
  "contentType": "Poll",
  "content": {
    "pollName": "Deploy window?",
    "pollOptions": ["Now", "Tonight", "Tomorrow"],
    "options": {
      "allowMultipleAnswers": false
    }
  }
}
```

Poll behavior:
- `allowMultipleAnswers: false` allows one selection.
- `allowMultipleAnswers: true` allows selecting up to all poll options.

### 10) Contact card message
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "Contact",
  "content": {
    "contactId": "19876543210@c.us"
  }
}
```

Contact behavior:
- Server builds a vCard using the numeric part of `contactId`.
- `contactId` accepts numeric, `@c.us`, or `@s.whatsapp.net` format.

### 11) Buttons/List content types
These are accepted for compatibility, but WhatsApp interactive buttons/lists are deprecated in many clients. The server sends a text fallback.

Buttons example:
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "Buttons",
  "content": {
    "title": "Actions",
    "body": "Choose an option",
    "footer": "Footer",
    "buttons": [
      { "id": "one", "body": "Option 1" },
      { "id": "two", "body": "Option 2" }
    ]
  }
}
```

Compatibility behavior:
- `Buttons`: fallback text uses `title`, `body`, `footer`. `buttons[]` are not rendered as interactive actions.
- `List`: fallback text uses `title`, `body`, `footer`. `buttonText` and `sections[]` are not interactive in current implementation.
- Account requirement: normal personal WhatsApp linked-device account works; no special business API account is required.

List example:
```json
{
  "chatId": "1234567890@c.us",
  "contentType": "List",
  "content": {
    "title": "Menu",
    "body": "Pick one item",
    "footer": "Footer",
    "buttonText": "Open",
    "sections": [
      {
        "title": "Main",
        "rows": [
          { "id": "r1", "title": "Row 1", "description": "First row" }
        ]
      }
    ]
  }
}
```

### Base64 tips and pitfalls
- Send raw base64 data in `content.data` (without `data:<mime>;base64,` prefix).
- Make sure `mimetype` matches payload bytes (`image/png`, `video/mp4`, `audio/ogg`, etc.).
- Large payloads are limited by server body size (`50mb` by default in this app).
- For URL media, the URL must be publicly reachable by the server runtime.
- For quoted replies, the referenced message must be available in the session store.

### How to generate base64 quickly
Linux/macOS:
```bash
base64 -w 0 ./photo.jpg
```

Windows PowerShell:
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes(".\photo.jpg"))
```

### Common send failures and fixes
- `Session not connected`: start session first with `GET /session/start/:sessionId` and wait for `ready`.
- `chatId, contentType, and content are required`: request body is missing required fields.
- `Unsupported content type`: `contentType` must be one of the documented enum values.
- URL media send fails: URL is not reachable from server network, times out, or blocks bot user-agent.
- Group send fails: ensure `chatId` is correct `@g.us`, account is in group, and group allows participants to send.
- Mention not visible: mentioned user ID must resolve to a valid WhatsApp user JID.

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
