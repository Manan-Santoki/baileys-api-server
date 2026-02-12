import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { Router } from 'express';

import currentRoutes from './index';
import { LEGACY_SWAGGER_OPERATIONS, type LegacyMethod } from './legacySwaggerOperations';
import sessionManager from '../services/SessionManager';
import logger from '../logger';
import { sendError, sendSuccess } from '../utils/responseHelper';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
type LegacyAdapter = (req: Request) => void;

interface LegacyTarget {
  method: HttpMethod;
  path: string;
  adapters?: LegacyAdapter[];
}

function operationKey(method: HttpMethod, path: string): string {
  return `${method} ${path}`;
}

function ensureObjectBody(req: Request): Record<string, unknown> {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    req.body = {};
  }

  return req.body as Record<string, unknown>;
}

function copyQueryToBodyForGet(req: Request): void {
  if (req.method !== 'GET') {
    return;
  }

  const body = ensureObjectBody(req);
  if (Object.keys(body).length > 0) {
    return;
  }

  if (Object.keys(req.query).length === 0) {
    return;
  }

  req.body = { ...req.query };
}

function aliasChatIdToGroupId(req: Request): void {
  const body = ensureObjectBody(req);

  if (typeof body.groupId !== 'string' && typeof body.chatId === 'string') {
    body.groupId = body.chatId;
  }
}

function aliasNumberToContactId(req: Request): void {
  const body = ensureObjectBody(req);

  if (typeof body.contactId !== 'string' && typeof body.number === 'string') {
    body.contactId = body.number;
  }
}

function aliasContactIdToChatId(req: Request): void {
  const body = ensureObjectBody(req);

  if (typeof body.chatId !== 'string' && typeof body.contactId === 'string') {
    body.chatId = body.contactId;
  }
}

function adaptMuteDuration(req: Request): void {
  const body = ensureObjectBody(req);

  if (typeof body.duration === 'number') {
    return;
  }

  const rawUnmuteDate = body.unmuteDate;
  if (!rawUnmuteDate) {
    return;
  }

  let unmuteTimestampMs: number | null = null;

  if (typeof rawUnmuteDate === 'number' && Number.isFinite(rawUnmuteDate)) {
    unmuteTimestampMs = rawUnmuteDate;
  } else if (typeof rawUnmuteDate === 'string') {
    const asNumber = Number(rawUnmuteDate);
    if (Number.isFinite(asNumber) && rawUnmuteDate.trim() !== '') {
      unmuteTimestampMs = asNumber;
    } else {
      const parsedDate = Date.parse(rawUnmuteDate);
      if (!Number.isNaN(parsedDate)) {
        unmuteTimestampMs = parsedDate;
      }
    }
  }

  if (unmuteTimestampMs === null) {
    return;
  }

  if (unmuteTimestampMs < 10_000_000_000) {
    unmuteTimestampMs *= 1000;
  }

  const durationSeconds = Math.max(1, Math.floor((unmuteTimestampMs - Date.now()) / 1000));
  body.duration = durationSeconds;
}

function adaptPresence(presence: 'available' | 'unavailable'): LegacyAdapter {
  return (req) => {
    const body = ensureObjectBody(req);
    body.presence = presence;
  };
}

function adaptUnstar(req: Request): void {
  const body = ensureObjectBody(req);
  body.star = false;
}

function adaptReplyToSendMessage(req: Request): void {
  const body = ensureObjectBody(req);

  const contentType = typeof body.contentType === 'string' ? body.contentType : 'string';
  const optionsSource = (body.options && typeof body.options === 'object' && !Array.isArray(body.options))
    ? (body.options as Record<string, unknown>)
    : {};

  if (typeof optionsSource.quotedMessageId !== 'string' && typeof body.messageId === 'string') {
    optionsSource.quotedMessageId = body.messageId;
  }

  body.contentType = contentType;
  body.options = optionsSource;
}

function adaptInviteInfoRequest(req: Request): void {
  const body = ensureObjectBody(req);

  if (typeof body.inviteCode === 'string') {
    return;
  }

  if (typeof body.displayName === 'string') {
    body.inviteCode = body.displayName;
    return;
  }

  if (typeof body.chatId === 'string') {
    body.inviteCode = body.chatId;
  }
}

function buildPath(pathTemplate: string, params: Record<string, string>): string {
  return pathTemplate.replace(/:([A-Za-z0-9_]+)/g, (_full, paramName: string) => {
    const value = params[paramName];
    return value ?? `:${paramName}`;
  });
}

function dispatchToCurrentRoute(
  req: Request,
  res: Response,
  next: NextFunction,
  legacyKey: string,
  target: LegacyTarget
): void {
  const originalMethod = req.method;
  const originalUrl = req.url;

  const queryStringIndex = req.url.indexOf('?');
  const queryString = queryStringIndex >= 0 ? req.url.slice(queryStringIndex) : '';

  req.method = target.method;
  req.url = buildPath(target.path, req.params as Record<string, string>) + queryString;

  const currentRouteHandler = currentRoutes as unknown as RequestHandler;

  currentRouteHandler(req, res, (error?: unknown) => {
    req.method = originalMethod;
    req.url = originalUrl;

    if (error) {
      next(error as Error);
      return;
    }

    if (!res.headersSent) {
      logger.warn({ legacyKey, target }, 'Legacy endpoint currently not implemented in compatibility bridge');
      sendError(
        res,
        `Legacy endpoint is registered but not implemented yet: ${legacyKey}`,
        501,
        'legacy_endpoint_not_implemented'
      );
    }
  });
}

const LEGACY_TARGET_OVERRIDES: Record<string, LegacyTarget> = {
  [operationKey('GET', '/client/getChats/:sessionId')]: {
    method: 'POST',
    path: '/client/getChats/:sessionId',
  },
  [operationKey('GET', '/client/getContacts/:sessionId')]: {
    method: 'POST',
    path: '/client/getContacts/:sessionId',
  },
  [operationKey('GET', '/client/getState/:sessionId')]: {
    method: 'GET',
    path: '/session/status/:sessionId',
  },
  [operationKey('GET', '/session/terminate/:sessionId')]: {
    method: 'DELETE',
    path: '/session/terminate/:sessionId',
  },
  [operationKey('POST', '/client/archiveChat/:sessionId')]: {
    method: 'POST',
    path: '/chat/archive/:sessionId',
  },
  [operationKey('POST', '/client/unarchiveChat/:sessionId')]: {
    method: 'POST',
    path: '/chat/unarchive/:sessionId',
  },
  [operationKey('POST', '/client/muteChat/:sessionId')]: {
    method: 'POST',
    path: '/chat/mute/:sessionId',
    adapters: [adaptMuteDuration],
  },
  [operationKey('POST', '/client/unmuteChat/:sessionId')]: {
    method: 'POST',
    path: '/chat/unmute/:sessionId',
  },
  [operationKey('POST', '/client/pinChat/:sessionId')]: {
    method: 'POST',
    path: '/chat/pin/:sessionId',
  },
  [operationKey('POST', '/client/unpinChat/:sessionId')]: {
    method: 'POST',
    path: '/chat/unpin/:sessionId',
  },
  [operationKey('POST', '/client/markChatUnread/:sessionId')]: {
    method: 'POST',
    path: '/chat/markUnread/:sessionId',
  },
  [operationKey('POST', '/client/sendSeen/:sessionId')]: {
    method: 'POST',
    path: '/chat/sendSeen/:sessionId',
  },
  [operationKey('POST', '/client/getFormattedNumber/:sessionId')]: {
    method: 'POST',
    path: '/contact/getFormattedNumber/:sessionId',
    adapters: [aliasNumberToContactId],
  },
  [operationKey('POST', '/client/getCountryCode/:sessionId')]: {
    method: 'POST',
    path: '/contact/getCountryCode/:sessionId',
    adapters: [aliasNumberToContactId],
  },
  [operationKey('POST', '/client/acceptInvite/:sessionId')]: {
    method: 'POST',
    path: '/groupChat/acceptInvite/:sessionId',
  },
  [operationKey('POST', '/client/getInviteInfo/:sessionId')]: {
    method: 'POST',
    path: '/groupChat/getInviteInfo/:sessionId',
    adapters: [adaptInviteInfoRequest],
  },
  [operationKey('POST', '/client/sendPresenceAvailable/:sessionId')]: {
    method: 'POST',
    path: '/client/sendPresenceUpdate/:sessionId',
    adapters: [adaptPresence('available')],
  },
  [operationKey('POST', '/client/sendPresenceUnavailable/:sessionId')]: {
    method: 'POST',
    path: '/client/sendPresenceUpdate/:sessionId',
    adapters: [adaptPresence('unavailable')],
  },
  [operationKey('POST', '/contact/getChat/:sessionId')]: {
    method: 'POST',
    path: '/client/getChatById/:sessionId',
    adapters: [aliasContactIdToChatId],
  },
  [operationKey('POST', '/groupChat/getClassInfo/:sessionId')]: {
    method: 'POST',
    path: '/groupChat/getGroupInfo/:sessionId',
    adapters: [aliasChatIdToGroupId],
  },
  [operationKey('POST', '/message/unstar/:sessionId')]: {
    method: 'POST',
    path: '/message/star/:sessionId',
    adapters: [adaptUnstar],
  },
  [operationKey('POST', '/message/reply/:sessionId')]: {
    method: 'POST',
    path: '/client/sendMessage/:sessionId',
    adapters: [adaptReplyToSendMessage],
  },
  [operationKey('POST', '/message/downloadMediaAsData/:sessionId')]: {
    method: 'POST',
    path: '/message/downloadMedia/:sessionId',
  },
};

const LEGACY_ENDPOINT_ADAPTERS: Record<string, LegacyAdapter[]> = {
  [operationKey('POST', '/groupChat/addParticipants/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/removeParticipants/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/promoteParticipants/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/demoteParticipants/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/setSubject/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/setDescription/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/setMessagesAdminsOnly/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/setInfoAdminsOnly/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/leave/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/getInviteCode/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/revokeInvite/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/setPicture/:sessionId')]: [aliasChatIdToGroupId],
  [operationKey('POST', '/groupChat/deletePicture/:sessionId')]: [aliasChatIdToGroupId],
};

const LEGACY_CUSTOM_HANDLERS: Record<string, RequestHandler> = {
  [operationKey('GET', '/session/terminateAll')]: async (_req, res) => {
    const sessionIds = sessionManager.getAllSessionIds();

    for (const sessionId of sessionIds) {
      await sessionManager.terminateSession(sessionId);
    }

    sendSuccess(res, {
      message: 'All active sessions terminated',
      terminatedCount: sessionIds.length,
      sessionIds,
    });
  },
  [operationKey('GET', '/session/terminateInactive')]: async (_req, res) => {
    const sessionIds = sessionManager.getAllSessionIds();
    const inactiveSessionIds = sessionIds.filter((sessionId) => sessionManager.getStatus(sessionId) !== 'connected');

    for (const sessionId of inactiveSessionIds) {
      await sessionManager.terminateSession(sessionId);
    }

    sendSuccess(res, {
      message: 'Inactive sessions terminated',
      terminatedCount: inactiveSessionIds.length,
      sessionIds: inactiveSessionIds,
    });
  },
  [operationKey('POST', '/localCallbackExample')]: async (req, res) => {
    sendSuccess(res, {
      message: 'Legacy callback endpoint received payload',
      payload: req.body || null,
    });
  },
};

function resolveTarget(method: HttpMethod, path: string): LegacyTarget {
  return LEGACY_TARGET_OVERRIDES[operationKey(method, path)] || { method, path };
}

function combineAdapters(method: HttpMethod, path: string, target: LegacyTarget): LegacyAdapter[] {
  const adapters: LegacyAdapter[] = [];

  if (method === 'GET') {
    adapters.push(copyQueryToBodyForGet);
  }

  const key = operationKey(method, path);
  const endpointAdapters = LEGACY_ENDPOINT_ADAPTERS[key] || [];
  const targetAdapters = target.adapters || [];

  adapters.push(...endpointAdapters, ...targetAdapters);

  return adapters;
}

function registerLegacyRoute(router: Router, method: LegacyMethod, path: string, handler: RequestHandler): void {
  switch (method) {
    case 'get':
      router.get(path, handler);
      break;
    case 'post':
      router.post(path, handler);
      break;
    case 'put':
      router.put(path, handler);
      break;
    case 'delete':
      router.delete(path, handler);
      break;
    case 'patch':
      router.patch(path, handler);
      break;
    default:
      router.all(path, handler);
      break;
  }
}

const legacyRouter = Router();

for (const operation of LEGACY_SWAGGER_OPERATIONS) {
  const method = operation.method.toUpperCase() as HttpMethod;
  const path = operation.path;
  const key = operationKey(method, path);
  const customHandler = LEGACY_CUSTOM_HANDLERS[key];

  if (customHandler) {
    registerLegacyRoute(legacyRouter, operation.method, path, customHandler);
    continue;
  }

  registerLegacyRoute(legacyRouter, operation.method, path, (req, res, next) => {
    const target = resolveTarget(method, path);
    const adapters = combineAdapters(method, path, target);

    for (const adapter of adapters) {
      try {
        adapter(req);
      } catch (error) {
        logger.warn({ key, error }, 'Legacy adapter failed');
      }
    }

    dispatchToCurrentRoute(req, res, next, key, target);
  });
}

export default legacyRouter;
