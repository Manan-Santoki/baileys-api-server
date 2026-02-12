const sessionIdParam = {
  name: 'sessionId',
  in: 'path',
  required: true,
  description: 'Unique session identifier.',
  schema: { type: 'string' },
};

const security = [{ ApiKeyAuth: [] }];

const defaultErrorResponse = {
  description: 'Error response',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
};

function successResponse(description: string, schemaRef?: string) {
  return {
    description,
    content: {
      'application/json': {
        schema: schemaRef
          ? {
              allOf: [
                { $ref: '#/components/schemas/SuccessEnvelope' },
                {
                  type: 'object',
                  properties: {
                    data: { $ref: schemaRef },
                  },
                },
              ],
            }
          : { $ref: '#/components/schemas/SuccessEnvelope' },
      },
    },
  };
}

function sessionPostOperation(input: {
  summary: string;
  tag: string;
  bodyRef?: string;
  description?: string;
  responseDescription?: string;
}) {
  return {
    tags: [input.tag],
    summary: input.summary,
    description: input.description,
    security,
    parameters: [sessionIdParam],
    requestBody: input.bodyRef
      ? {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: input.bodyRef },
            },
          },
        }
      : undefined,
    responses: {
      200: successResponse(input.responseDescription || 'Successful operation'),
      400: defaultErrorResponse,
      401: defaultErrorResponse,
      404: defaultErrorResponse,
      500: defaultErrorResponse,
    },
  };
}

const postRoutes: Array<{
  path: string;
  summary: string;
  tag: string;
  bodyRef?: string;
  description?: string;
  responseDescription?: string;
}> = [
  // Session
  {
    path: '/session/requestPairingCode/{sessionId}',
    summary: 'Request pairing code',
    tag: 'Session',
    bodyRef: '#/components/schemas/PairingCodeRequest',
    responseDescription: 'Pairing code requested',
  },

  // Client
  {
    path: '/client/sendMessage/{sessionId}',
    summary: 'Send message',
    tag: 'Client',
    bodyRef: '#/components/schemas/SendMessageRequest',
    responseDescription: 'Message sent',
  },
  {
    path: '/client/getChats/{sessionId}',
    summary: 'Get chats',
    tag: 'Client',
    bodyRef: '#/components/schemas/EmptyRequest',
    responseDescription: 'Chats fetched',
  },
  {
    path: '/client/getChatById/{sessionId}',
    summary: 'Get chat by ID',
    tag: 'Client',
    bodyRef: '#/components/schemas/ChatIdRequest',
    responseDescription: 'Chat fetched',
  },
  {
    path: '/client/getContacts/{sessionId}',
    summary: 'Get contacts',
    tag: 'Client',
    bodyRef: '#/components/schemas/EmptyRequest',
    responseDescription: 'Contacts fetched',
  },
  {
    path: '/client/getContactById/{sessionId}',
    summary: 'Get contact by ID',
    tag: 'Client',
    bodyRef: '#/components/schemas/ContactIdRequest',
    responseDescription: 'Contact fetched',
  },
  {
    path: '/client/isRegisteredUser/{sessionId}',
    summary: 'Check if contact is on WhatsApp',
    tag: 'Client',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/client/getInfo/{sessionId}',
    summary: 'Get client profile info',
    tag: 'Client',
    bodyRef: '#/components/schemas/EmptyRequest',
  },
  {
    path: '/client/getLabels/{sessionId}',
    summary: 'Get business labels',
    tag: 'Client',
    bodyRef: '#/components/schemas/EmptyRequest',
  },
  {
    path: '/client/createGroup/{sessionId}',
    summary: 'Create group',
    tag: 'Client',
    bodyRef: '#/components/schemas/CreateGroupRequest',
  },
  {
    path: '/client/getProfilePicUrl/{sessionId}',
    summary: 'Get profile picture URL',
    tag: 'Client',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/client/getBlockedContacts/{sessionId}',
    summary: 'Get blocked contacts',
    tag: 'Client',
    bodyRef: '#/components/schemas/EmptyRequest',
  },
  {
    path: '/client/blockContact/{sessionId}',
    summary: 'Block contact',
    tag: 'Client',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/client/unblockContact/{sessionId}',
    summary: 'Unblock contact',
    tag: 'Client',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/client/setStatus/{sessionId}',
    summary: 'Set profile status',
    tag: 'Client',
    bodyRef: '#/components/schemas/SetStatusRequest',
  },
  {
    path: '/client/setDisplayName/{sessionId}',
    summary: 'Set display name',
    tag: 'Client',
    bodyRef: '#/components/schemas/SetDisplayNameRequest',
  },
  {
    path: '/client/getCommonGroups/{sessionId}',
    summary: 'Get common groups with contact',
    tag: 'Client',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/client/getNumberId/{sessionId}',
    summary: 'Resolve WhatsApp number ID',
    tag: 'Client',
    bodyRef: '#/components/schemas/NumberRequest',
  },
  {
    path: '/client/sendPresenceUpdate/{sessionId}',
    summary: 'Send global presence update',
    tag: 'Client',
    bodyRef: '#/components/schemas/SendPresenceUpdateRequest',
  },

  // Chat
  {
    path: '/chat/fetchMessages/{sessionId}',
    summary: 'Fetch local messages from chat',
    tag: 'Chat',
    bodyRef: '#/components/schemas/FetchMessagesRequest',
  },
  {
    path: '/chat/sendStateTyping/{sessionId}',
    summary: 'Send typing state',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/clearState/{sessionId}',
    summary: 'Clear chat typing/recording state',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/sendStateRecording/{sessionId}',
    summary: 'Send recording state',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/sendSeen/{sessionId}',
    summary: 'Mark chat as seen',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/markUnread/{sessionId}',
    summary: 'Mark chat as unread',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/archive/{sessionId}',
    summary: 'Archive chat',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/unarchive/{sessionId}',
    summary: 'Unarchive chat',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/pin/{sessionId}',
    summary: 'Pin chat',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/unpin/{sessionId}',
    summary: 'Unpin chat',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/mute/{sessionId}',
    summary: 'Mute chat',
    tag: 'Chat',
    bodyRef: '#/components/schemas/MuteChatRequest',
  },
  {
    path: '/chat/unmute/{sessionId}',
    summary: 'Unmute chat',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/clearMessages/{sessionId}',
    summary: 'Clear chat messages locally',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/delete/{sessionId}',
    summary: 'Delete chat',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/getLabels/{sessionId}',
    summary: 'Get chat labels',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },
  {
    path: '/chat/getContact/{sessionId}',
    summary: 'Get contact for chat',
    tag: 'Chat',
    bodyRef: '#/components/schemas/ChatIdRequest',
  },

  // Contact
  {
    path: '/contact/getAbout/{sessionId}',
    summary: 'Get contact about/status',
    tag: 'Contact',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/contact/getProfilePicUrl/{sessionId}',
    summary: 'Get contact profile picture URL',
    tag: 'Contact',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/contact/block/{sessionId}',
    summary: 'Block contact',
    tag: 'Contact',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/contact/unblock/{sessionId}',
    summary: 'Unblock contact',
    tag: 'Contact',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/contact/isBlocked/{sessionId}',
    summary: 'Check if contact is blocked',
    tag: 'Contact',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/contact/getCommonGroups/{sessionId}',
    summary: 'Get common groups with contact',
    tag: 'Contact',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/contact/getFormattedNumber/{sessionId}',
    summary: 'Get formatted phone number',
    tag: 'Contact',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },
  {
    path: '/contact/getCountryCode/{sessionId}',
    summary: 'Get phone country code',
    tag: 'Contact',
    bodyRef: '#/components/schemas/ContactIdRequest',
  },

  // Group Chat
  {
    path: '/groupChat/getGroupInfo/{sessionId}',
    summary: 'Get group metadata',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupIdRequest',
  },
  {
    path: '/groupChat/getParticipants/{sessionId}',
    summary: 'Get group participants',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupIdRequest',
  },
  {
    path: '/groupChat/addParticipants/{sessionId}',
    summary: 'Add participants to group',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupParticipantsRequest',
  },
  {
    path: '/groupChat/removeParticipants/{sessionId}',
    summary: 'Remove participants from group',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupParticipantsRequest',
  },
  {
    path: '/groupChat/promoteParticipants/{sessionId}',
    summary: 'Promote participants to admin',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupParticipantsRequest',
  },
  {
    path: '/groupChat/demoteParticipants/{sessionId}',
    summary: 'Demote admins',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupParticipantsRequest',
  },
  {
    path: '/groupChat/setSubject/{sessionId}',
    summary: 'Set group subject',
    tag: 'Group',
    bodyRef: '#/components/schemas/SetGroupSubjectRequest',
  },
  {
    path: '/groupChat/setDescription/{sessionId}',
    summary: 'Set group description',
    tag: 'Group',
    bodyRef: '#/components/schemas/SetGroupDescriptionRequest',
  },
  {
    path: '/groupChat/setMessagesAdminsOnly/{sessionId}',
    summary: 'Set who can send messages',
    tag: 'Group',
    bodyRef: '#/components/schemas/SetGroupAdminsOnlyRequest',
  },
  {
    path: '/groupChat/setInfoAdminsOnly/{sessionId}',
    summary: 'Set who can edit group info',
    tag: 'Group',
    bodyRef: '#/components/schemas/SetGroupAdminsOnlyRequest',
  },
  {
    path: '/groupChat/leave/{sessionId}',
    summary: 'Leave group',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupIdRequest',
  },
  {
    path: '/groupChat/getInviteCode/{sessionId}',
    summary: 'Get group invite code',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupIdRequest',
  },
  {
    path: '/groupChat/revokeInvite/{sessionId}',
    summary: 'Revoke group invite code',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupIdRequest',
  },
  {
    path: '/groupChat/acceptInvite/{sessionId}',
    summary: 'Accept invite code',
    tag: 'Group',
    bodyRef: '#/components/schemas/InviteCodeRequest',
  },
  {
    path: '/groupChat/getInviteInfo/{sessionId}',
    summary: 'Get invite metadata',
    tag: 'Group',
    bodyRef: '#/components/schemas/InviteCodeRequest',
  },
  {
    path: '/groupChat/setPicture/{sessionId}',
    summary: 'Set group picture',
    tag: 'Group',
    bodyRef: '#/components/schemas/SetGroupPictureRequest',
  },
  {
    path: '/groupChat/deletePicture/{sessionId}',
    summary: 'Delete group picture',
    tag: 'Group',
    bodyRef: '#/components/schemas/GroupIdRequest',
  },

  // Message
  {
    path: '/message/getInfo/{sessionId}',
    summary: 'Get message receipts',
    tag: 'Message',
    bodyRef: '#/components/schemas/MessageLookupRequest',
  },
  {
    path: '/message/react/{sessionId}',
    summary: 'React to message',
    tag: 'Message',
    bodyRef: '#/components/schemas/ReactMessageRequest',
  },
  {
    path: '/message/star/{sessionId}',
    summary: 'Star or unstar message',
    tag: 'Message',
    bodyRef: '#/components/schemas/StarMessageRequest',
  },
  {
    path: '/message/delete/{sessionId}',
    summary: 'Delete message',
    tag: 'Message',
    bodyRef: '#/components/schemas/DeleteMessageRequest',
  },
  {
    path: '/message/forward/{sessionId}',
    summary: 'Forward message',
    tag: 'Message',
    bodyRef: '#/components/schemas/ForwardMessageRequest',
  },
  {
    path: '/message/downloadMedia/{sessionId}',
    summary: 'Download media from message',
    tag: 'Message',
    bodyRef: '#/components/schemas/DownloadMediaRequest',
  },
  {
    path: '/message/getQuotedMessage/{sessionId}',
    summary: 'Get quoted message',
    tag: 'Message',
    bodyRef: '#/components/schemas/MessageLookupRequest',
  },
  {
    path: '/message/getMentions/{sessionId}',
    summary: 'Get message mentions',
    tag: 'Message',
    bodyRef: '#/components/schemas/GetMentionsRequest',
  },
  {
    path: '/message/edit/{sessionId}',
    summary: 'Edit message',
    tag: 'Message',
    bodyRef: '#/components/schemas/EditMessageRequest',
  },
  {
    path: '/message/pin/{sessionId}',
    summary: 'Pin message in chat',
    tag: 'Message',
    bodyRef: '#/components/schemas/PinMessageRequest',
  },
  {
    path: '/message/unpin/{sessionId}',
    summary: 'Unpin message in chat',
    tag: 'Message',
    bodyRef: '#/components/schemas/MessageLookupRequest',
  },
];

const paths: Record<string, any> = {
  '/ping': {
    get: {
      tags: ['System'],
      summary: 'Health check',
      security,
      responses: {
        200: successResponse('Server is healthy'),
      },
    },
  },

  '/session/start/{sessionId}': {
    get: {
      tags: ['Session'],
      summary: 'Start session',
      security,
      parameters: [sessionIdParam],
      responses: {
        200: successResponse('Session started'),
        400: defaultErrorResponse,
        401: defaultErrorResponse,
        500: defaultErrorResponse,
      },
    },
  },

  '/session/stop/{sessionId}': {
    get: {
      tags: ['Session'],
      summary: 'Stop session',
      security,
      parameters: [sessionIdParam],
      responses: {
        200: successResponse('Session stopped'),
        404: defaultErrorResponse,
        500: defaultErrorResponse,
      },
    },
  },

  '/session/status/{sessionId}': {
    get: {
      tags: ['Session'],
      summary: 'Get session status',
      security,
      parameters: [sessionIdParam],
      responses: {
        200: successResponse('Session status fetched'),
        404: defaultErrorResponse,
      },
    },
  },

  '/session/terminate/{sessionId}': {
    delete: {
      tags: ['Session'],
      summary: 'Terminate session and delete auth data',
      security,
      parameters: [sessionIdParam],
      responses: {
        200: successResponse('Session terminated'),
        500: defaultErrorResponse,
      },
    },
  },

  '/session/getSessions': {
    get: {
      tags: ['Session'],
      summary: 'List active sessions',
      security,
      responses: {
        200: successResponse('Sessions listed'),
      },
    },
  },

  '/session/qr/{sessionId}': {
    get: {
      tags: ['Session'],
      summary: 'Get session QR (raw text)',
      security,
      parameters: [sessionIdParam],
      responses: {
        200: successResponse('QR fetched'),
        404: defaultErrorResponse,
      },
    },
  },

  '/session/qr/{sessionId}/image': {
    get: {
      tags: ['Session'],
      summary: 'Get session QR image',
      security,
      parameters: [sessionIdParam],
      responses: {
        200: {
          description: 'PNG image',
          content: {
            'image/png': {
              schema: {
                type: 'string',
                format: 'binary',
              },
            },
          },
        },
        404: defaultErrorResponse,
      },
    },
  },

  '/session/logout/{sessionId}': {
    get: {
      tags: ['Session'],
      summary: 'Logout session',
      security,
      parameters: [sessionIdParam],
      responses: {
        200: successResponse('Logged out'),
        404: defaultErrorResponse,
        500: defaultErrorResponse,
      },
    },
  },

  '/session/restart/{sessionId}': {
    get: {
      tags: ['Session'],
      summary: 'Restart session',
      security,
      parameters: [sessionIdParam],
      responses: {
        200: successResponse('Session restarted'),
        500: defaultErrorResponse,
      },
    },
  },

  '/ws': {
    get: {
      tags: ['Events'],
      summary: 'WebSocket event stream',
      description:
        'Upgrade to WebSocket on this path to receive all realtime Baileys events. Use `?sessionId=<id>` to filter by session and `?apiKey=<API_KEY>` (or header `x-api-key`) when API key auth is enabled. This endpoint is available only when `ENABLE_WEBSOCKET=true`.',
      parameters: [
        {
          name: 'sessionId',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Optional: stream only this session.',
        },
        {
          name: 'apiKey',
          in: 'query',
          required: false,
          schema: { type: 'string' },
          description: 'Optional API key if not sent in header.',
        },
      ],
      responses: {
        101: {
          description: 'WebSocket upgrade successful',
        },
      },
    },
  },
};

for (const route of postRoutes) {
  paths[route.path] = {
    ...(paths[route.path] || {}),
    post: sessionPostOperation(route),
  };
}

export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Baileys REST API Server',
    version: '1.0.0',
    description:
      'REST wrapper for Baileys WhatsApp Web socket. Supports multi-session auth, messaging, chats, contacts, groups, message actions, outbound webhooks, and websocket event streaming.',
  },
  servers: [
    {
      url: '/',
      description: 'Current server',
    },
  ],
  tags: [
    { name: 'System' },
    { name: 'Session' },
    { name: 'Client' },
    { name: 'Chat' },
    { name: 'Contact' },
    { name: 'Group' },
    { name: 'Message' },
    { name: 'Events' },
  ],
  security: security,
  paths,
  webhooks: {
    whatsappEvent: {
      post: {
        tags: ['Events'],
        summary: 'Outbound webhook payload sent by this server',
        description:
          'This is the payload shape delivered to `BASE_WEBHOOK_URL` for each enabled event. Delivery occurs only when `ENABLE_WEBHOOK=true`.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WebhookEventPayload' },
            },
          },
        },
        responses: {
          200: {
            description: 'Your webhook endpoint acknowledged the event',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
      },
    },
    schemas: {
      SuccessEnvelope: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
        },
        required: ['success'],
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: { type: 'string', example: 'chatId is required' },
          message: { type: 'string', example: 'validation_error' },
        },
        required: ['success', 'error'],
      },
      EmptyRequest: {
        type: 'object',
        additionalProperties: false,
      },
      MediaContent: {
        type: 'object',
        properties: {
          mimetype: { type: 'string', example: 'image/png' },
          data: {
            type: 'string',
            description: 'Base64-encoded media payload.',
          },
          filename: { type: 'string', example: 'photo.png' },
        },
        required: ['mimetype', 'data'],
      },
      SendMessageRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string', example: '14155551234@c.us' },
          contentType: {
            type: 'string',
            enum: ['string', 'MessageMedia', 'MessageMediaFromURL', 'Location', 'Poll', 'Contact', 'Buttons', 'List'],
          },
          content: {
            oneOf: [
              { type: 'string' },
              { $ref: '#/components/schemas/MediaContent' },
              {
                type: 'object',
                properties: {
                  latitude: { type: 'number' },
                  longitude: { type: 'number' },
                  description: { type: 'string' },
                },
                required: ['latitude', 'longitude'],
              },
              {
                type: 'object',
                properties: {
                  pollName: { type: 'string' },
                  pollOptions: {
                    type: 'array',
                    items: { type: 'string' },
                  },
                },
                required: ['pollName', 'pollOptions'],
              },
            ],
          },
          options: {
            type: 'object',
            properties: {
              quotedMessageId: { type: 'string' },
              mentions: {
                type: 'array',
                items: { type: 'string' },
              },
              caption: { type: 'string' },
              sendAudioAsVoice: { type: 'boolean' },
              sendVideoAsGif: { type: 'boolean' },
              linkPreview: { type: 'boolean' },
            },
          },
        },
        required: ['chatId', 'contentType', 'content'],
      },
      ChatIdRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string', example: '14155551234@c.us' },
        },
        required: ['chatId'],
      },
      FetchMessagesRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string', example: '14155551234@c.us' },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 50 },
          before: {
            type: 'string',
            description: 'Fetch older messages before this message id.',
          },
        },
        required: ['chatId'],
      },
      ContactIdRequest: {
        type: 'object',
        properties: {
          contactId: { type: 'string', example: '14155551234@c.us' },
        },
        required: ['contactId'],
      },
      GroupIdRequest: {
        type: 'object',
        properties: {
          groupId: { type: 'string', example: '120363123456789012@g.us' },
        },
        required: ['groupId'],
      },
      GroupParticipantsRequest: {
        type: 'object',
        properties: {
          groupId: { type: 'string', example: '120363123456789012@g.us' },
          participants: {
            type: 'array',
            items: { type: 'string', example: '14155551234@c.us' },
          },
        },
        required: ['groupId', 'participants'],
      },
      SetGroupSubjectRequest: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
          subject: { type: 'string' },
        },
        required: ['groupId', 'subject'],
      },
      SetGroupDescriptionRequest: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['groupId'],
      },
      SetGroupAdminsOnlyRequest: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
          adminsOnly: { type: 'boolean' },
        },
        required: ['groupId', 'adminsOnly'],
      },
      InviteCodeRequest: {
        type: 'object',
        properties: {
          inviteCode: { type: 'string' },
        },
        required: ['inviteCode'],
      },
      SetGroupPictureRequest: {
        type: 'object',
        properties: {
          groupId: { type: 'string' },
          image: {
            oneOf: [
              { type: 'string', description: 'Base64 image string.' },
              {
                type: 'object',
                properties: {
                  data: { type: 'string' },
                },
                required: ['data'],
              },
            ],
          },
        },
        required: ['groupId', 'image'],
      },
      MessageLookupRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          messageId: { type: 'string' },
        },
        required: ['chatId', 'messageId'],
      },
      ReactMessageRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          messageId: { type: 'string' },
          emoji: { type: 'string', example: '👍' },
        },
        required: ['chatId', 'messageId', 'emoji'],
      },
      StarMessageRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          messageId: { type: 'string' },
          star: { type: 'boolean' },
        },
        required: ['chatId', 'messageId', 'star'],
      },
      DeleteMessageRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          messageId: { type: 'string' },
          forEveryone: { type: 'boolean', default: false },
        },
        required: ['chatId', 'messageId'],
      },
      ForwardMessageRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          messageId: { type: 'string' },
          targetChatId: { type: 'string' },
        },
        required: ['chatId', 'messageId', 'targetChatId'],
      },
      DownloadMediaRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          messageId: { type: 'string' },
          messageData: {
            type: 'object',
            description: 'Optional raw Baileys message object to download directly.',
            additionalProperties: true,
          },
        },
      },
      GetMentionsRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          messageId: { type: 'string' },
          messageData: {
            type: 'object',
            additionalProperties: true,
          },
        },
      },
      EditMessageRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          messageId: { type: 'string' },
          newContent: { type: 'string' },
        },
        required: ['chatId', 'messageId', 'newContent'],
      },
      PinMessageRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          messageId: { type: 'string' },
          duration: {
            type: 'integer',
            description: 'Allowed values: 86400 (1 day), 604800 (7 days), 2592000 (30 days).',
            example: 604800,
          },
        },
        required: ['chatId', 'messageId'],
      },
      PairingCodeRequest: {
        type: 'object',
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'E.164 digits only (no +). Example: 14155551234',
          },
        },
        required: ['phoneNumber'],
      },
      CreateGroupRequest: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          participants: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['name', 'participants'],
      },
      SetStatusRequest: {
        type: 'object',
        properties: {
          status: { type: 'string' },
        },
        required: ['status'],
      },
      SetDisplayNameRequest: {
        type: 'object',
        properties: {
          displayName: { type: 'string' },
        },
        required: ['displayName'],
      },
      NumberRequest: {
        type: 'object',
        properties: {
          number: {
            type: 'string',
            description: 'Phone number with or without country code, digits preferred.',
          },
        },
        required: ['number'],
      },
      SendPresenceUpdateRequest: {
        type: 'object',
        properties: {
          presence: {
            type: 'string',
            enum: ['available', 'unavailable', 'composing', 'recording', 'paused'],
          },
        },
        required: ['presence'],
      },
      MuteChatRequest: {
        type: 'object',
        properties: {
          chatId: { type: 'string' },
          duration: {
            type: 'integer',
            description: 'Mute duration in seconds.',
            default: 28800,
          },
        },
        required: ['chatId'],
      },
      WebhookEventPayload: {
        type: 'object',
        properties: {
          sessionId: { type: 'string' },
          dataType: {
            type: 'string',
            description:
              'Event type. Examples: qr, ready, authenticated, disconnected, message, message_create, message_ack, message_reaction, group_join, group_leave, group_update, call, chat_archived, chat_removed, unread_count.',
          },
          data: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: ['sessionId', 'dataType', 'data'],
      },
      WebSocketEventPayload: {
        allOf: [
          { $ref: '#/components/schemas/WebhookEventPayload' },
          {
            type: 'object',
            properties: {
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
    },
  },
};

export default openApiSpec;
