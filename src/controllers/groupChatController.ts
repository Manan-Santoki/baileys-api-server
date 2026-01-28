import type { Request, Response } from 'express';
import sessionManager from '../services/SessionManager';
import logger from '../logger';
import { sendSuccess, sendError } from '../utils/responseHelper';
import { toBaileysJid, toWwebjsJid, createSerializedId, getPhoneNumber } from '../utils/jidHelper';

/**
 * Get group metadata
 */
export async function getGroupInfo(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId } = req.body;

  if (!groupId) {
    sendError(res, 'groupId is required', 400, 'validation_error');
    return;
  }

  try {
    const metadata = await sessionManager.getGroupMetadata(sessionId, groupId);

    if (metadata) {
      sendSuccess(res, { group: metadata });
    } else {
      sendError(res, 'Group not found', 404, 'group_not_found');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get group info';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error getting group info');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get group participants
 */
export async function getParticipants(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId } = req.body;

  if (!groupId) {
    sendError(res, 'groupId is required', 400, 'validation_error');
    return;
  }

  try {
    const metadata = await sessionManager.getGroupMetadata(sessionId, groupId);

    if (metadata) {
      sendSuccess(res, { participants: metadata.participants });
    } else {
      sendError(res, 'Group not found', 404, 'group_not_found');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get participants';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error getting participants');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Add participants to group
 */
export async function addParticipants(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId, participants } = req.body;

  if (!groupId || !participants || !Array.isArray(participants)) {
    sendError(res, 'groupId and participants array are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    const participantJids = participants.map(toBaileysJid);

    await session.socket.groupParticipantsUpdate(jid, participantJids, 'add');
    sendSuccess(res, { message: 'Participants added' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add participants';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error adding participants');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Remove participants from group
 */
export async function removeParticipants(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId, participants } = req.body;

  if (!groupId || !participants || !Array.isArray(participants)) {
    sendError(res, 'groupId and participants array are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    const participantJids = participants.map(toBaileysJid);

    await session.socket.groupParticipantsUpdate(jid, participantJids, 'remove');
    sendSuccess(res, { message: 'Participants removed' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to remove participants';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error removing participants');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Promote participants to admin
 */
export async function promoteParticipants(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId, participants } = req.body;

  if (!groupId || !participants || !Array.isArray(participants)) {
    sendError(res, 'groupId and participants array are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    const participantJids = participants.map(toBaileysJid);

    await session.socket.groupParticipantsUpdate(jid, participantJids, 'promote');
    sendSuccess(res, { message: 'Participants promoted' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to promote participants';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error promoting participants');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Demote admins to regular participants
 */
export async function demoteParticipants(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId, participants } = req.body;

  if (!groupId || !participants || !Array.isArray(participants)) {
    sendError(res, 'groupId and participants array are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    const participantJids = participants.map(toBaileysJid);

    await session.socket.groupParticipantsUpdate(jid, participantJids, 'demote');
    sendSuccess(res, { message: 'Participants demoted' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to demote participants';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error demoting participants');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Set group subject (name)
 */
export async function setSubject(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId, subject } = req.body;

  if (!groupId || !subject) {
    sendError(res, 'groupId and subject are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    await session.socket.groupUpdateSubject(jid, subject);
    sendSuccess(res, { message: 'Group subject updated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set subject';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error setting subject');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Set group description
 */
export async function setDescription(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId, description } = req.body;

  if (!groupId) {
    sendError(res, 'groupId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    await session.socket.groupUpdateDescription(jid, description || '');
    sendSuccess(res, { message: 'Group description updated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set description';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error setting description');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Set group settings (who can send messages)
 */
export async function setMessagesAdminsOnly(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId, adminsOnly } = req.body;

  if (!groupId || adminsOnly === undefined) {
    sendError(res, 'groupId and adminsOnly are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    await session.socket.groupSettingUpdate(jid, adminsOnly ? 'announcement' : 'not_announcement');
    sendSuccess(res, { message: 'Group settings updated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set messages setting';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error setting messages setting');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Set group settings (who can edit group info)
 */
export async function setInfoAdminsOnly(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId, adminsOnly } = req.body;

  if (!groupId || adminsOnly === undefined) {
    sendError(res, 'groupId and adminsOnly are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    await session.socket.groupSettingUpdate(jid, adminsOnly ? 'locked' : 'unlocked');
    sendSuccess(res, { message: 'Group settings updated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set info setting';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error setting info setting');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Leave group
 */
export async function leave(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId } = req.body;

  if (!groupId) {
    sendError(res, 'groupId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    await session.socket.groupLeave(jid);
    sendSuccess(res, { message: 'Left group' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to leave group';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error leaving group');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get group invite code
 */
export async function getInviteCode(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId } = req.body;

  if (!groupId) {
    sendError(res, 'groupId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    const code = await session.socket.groupInviteCode(jid);
    sendSuccess(res, { inviteCode: code });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get invite code';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error getting invite code');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Revoke group invite code
 */
export async function revokeInvite(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId } = req.body;

  if (!groupId) {
    sendError(res, 'groupId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    const newCode = await session.socket.groupRevokeInvite(jid);
    sendSuccess(res, { inviteCode: newCode });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to revoke invite';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error revoking invite');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Join group by invite code
 */
export async function acceptInvite(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { inviteCode } = req.body;

  if (!inviteCode) {
    sendError(res, 'inviteCode is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const groupId = await session.socket.groupAcceptInvite(inviteCode);
    sendSuccess(res, { groupId: createSerializedId(groupId!) });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to accept invite';
    logger.error({ sessionId, inviteCode, error: errorMessage }, 'Error accepting invite');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Get group info from invite link
 */
export async function getInviteInfo(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { inviteCode } = req.body;

  if (!inviteCode) {
    sendError(res, 'inviteCode is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const info = await session.socket.groupGetInviteInfo(inviteCode);
    sendSuccess(res, {
      group: {
        id: createSerializedId(info.id),
        subject: info.subject,
        owner: info.owner ? toWwebjsJid(info.owner) : null,
        creation: info.creation,
        desc: info.desc,
        size: info.size,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to get invite info';
    logger.error({ sessionId, inviteCode, error: errorMessage }, 'Error getting invite info');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Set group profile picture
 */
export async function setPicture(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId, image } = req.body;

  if (!groupId || !image) {
    sendError(res, 'groupId and image are required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    const buffer = Buffer.from(image.data || image, 'base64');
    await session.socket.updateProfilePicture(jid, buffer);
    sendSuccess(res, { message: 'Group picture updated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to set picture';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error setting picture');
    sendError(res, errorMessage, 500);
  }
}

/**
 * Delete group profile picture
 */
export async function deletePicture(req: Request, res: Response): Promise<void> {
  const { sessionId } = req.params;
  const { groupId } = req.body;

  if (!groupId) {
    sendError(res, 'groupId is required', 400, 'validation_error');
    return;
  }

  const session = sessionManager.getSession(sessionId);
  if (!session || session.status !== 'connected') {
    sendError(res, 'Session not connected', 400, 'session_not_connected');
    return;
  }

  try {
    const jid = toBaileysJid(groupId);
    await session.socket.removeProfilePicture(jid);
    sendSuccess(res, { message: 'Group picture deleted' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete picture';
    logger.error({ sessionId, groupId, error: errorMessage }, 'Error deleting picture');
    sendError(res, errorMessage, 500);
  }
}

export default {
  getGroupInfo,
  getParticipants,
  addParticipants,
  removeParticipants,
  promoteParticipants,
  demoteParticipants,
  setSubject,
  setDescription,
  setMessagesAdminsOnly,
  setInfoAdminsOnly,
  leave,
  getInviteCode,
  revokeInvite,
  acceptInvite,
  getInviteInfo,
  setPicture,
  deletePicture,
};
