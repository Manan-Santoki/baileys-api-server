import { Router } from 'express';
import { sessionExists, sessionConnected } from '../middleware/sessionMiddleware';

// Controllers
import healthController from '../controllers/healthController';
import sessionController from '../controllers/sessionController';
import clientController from '../controllers/clientController';
import chatController from '../controllers/chatController';
import contactController from '../controllers/contactController';
import groupChatController from '../controllers/groupChatController';
import messageController from '../controllers/messageController';

const router = Router();

// ============================================================================
// Health Check
// ============================================================================
router.get('/ping', healthController.ping);

// ============================================================================
// Session Management
// ============================================================================
router.get('/session/start/:sessionId', sessionController.startSession);
router.get('/session/stop/:sessionId', sessionController.stopSession);
router.get('/session/status/:sessionId', sessionController.getStatus);
router.delete('/session/terminate/:sessionId', sessionController.terminateSession);
router.get('/session/getSessions', sessionController.getSessions);
router.get('/session/qr/:sessionId', sessionController.getQr);
router.get('/session/qr/:sessionId/image', sessionController.getQrImage);
router.post('/session/requestPairingCode/:sessionId', sessionController.requestPairingCode);
router.get('/session/logout/:sessionId', sessionController.logoutSession);
router.get('/session/restart/:sessionId', sessionController.restartSession);

// ============================================================================
// Client Operations
// ============================================================================
router.post('/client/sendMessage/:sessionId', sessionConnected, clientController.sendMessage);
router.post('/client/getChats/:sessionId', sessionConnected, clientController.getChats);
router.post('/client/getChatById/:sessionId', sessionConnected, clientController.getChatById);
router.post('/client/getContacts/:sessionId', sessionConnected, clientController.getContacts);
router.post('/client/getContactById/:sessionId', sessionConnected, clientController.getContactById);
router.post('/client/isRegisteredUser/:sessionId', sessionConnected, clientController.isRegisteredUser);
router.post('/client/getInfo/:sessionId', sessionConnected, clientController.getInfo);
router.post('/client/getLabels/:sessionId', sessionConnected, clientController.getLabels);
router.post('/client/createGroup/:sessionId', sessionConnected, clientController.createGroup);
router.post('/client/getProfilePicUrl/:sessionId', sessionConnected, clientController.getProfilePicUrl);
router.post('/client/getBlockedContacts/:sessionId', sessionConnected, clientController.getBlockedContacts);
router.post('/client/blockContact/:sessionId', sessionConnected, clientController.blockContact);
router.post('/client/unblockContact/:sessionId', sessionConnected, clientController.unblockContact);
router.post('/client/setStatus/:sessionId', sessionConnected, clientController.setStatus);
router.post('/client/setDisplayName/:sessionId', sessionConnected, clientController.setDisplayName);
router.post('/client/getCommonGroups/:sessionId', sessionConnected, clientController.getCommonGroups);
router.post('/client/getNumberId/:sessionId', sessionConnected, clientController.getNumberId);
router.post('/client/sendPresenceUpdate/:sessionId', sessionConnected, clientController.sendPresenceUpdate);

// ============================================================================
// Chat Operations
// ============================================================================
router.post('/chat/fetchMessages/:sessionId', sessionConnected, chatController.fetchMessages);
router.post('/chat/sendStateTyping/:sessionId', sessionConnected, chatController.sendStateTyping);
router.post('/chat/clearState/:sessionId', sessionConnected, chatController.clearState);
router.post('/chat/sendStateRecording/:sessionId', sessionConnected, chatController.sendStateRecording);
router.post('/chat/sendSeen/:sessionId', sessionConnected, chatController.sendSeen);
router.post('/chat/markUnread/:sessionId', sessionConnected, chatController.markUnread);
router.post('/chat/archive/:sessionId', sessionConnected, chatController.archive);
router.post('/chat/unarchive/:sessionId', sessionConnected, chatController.unarchive);
router.post('/chat/pin/:sessionId', sessionConnected, chatController.pin);
router.post('/chat/unpin/:sessionId', sessionConnected, chatController.unpin);
router.post('/chat/mute/:sessionId', sessionConnected, chatController.mute);
router.post('/chat/unmute/:sessionId', sessionConnected, chatController.unmute);
router.post('/chat/clearMessages/:sessionId', sessionConnected, chatController.clearMessages);
router.post('/chat/delete/:sessionId', sessionConnected, chatController.deleteChat);
router.post('/chat/getLabels/:sessionId', sessionConnected, chatController.getLabels);
router.post('/chat/getContact/:sessionId', sessionConnected, chatController.getContact);

// ============================================================================
// Contact Operations
// ============================================================================
router.post('/contact/getAbout/:sessionId', sessionConnected, contactController.getAbout);
router.post('/contact/getProfilePicUrl/:sessionId', sessionConnected, contactController.getProfilePicUrl);
router.post('/contact/block/:sessionId', sessionConnected, contactController.block);
router.post('/contact/unblock/:sessionId', sessionConnected, contactController.unblock);
router.post('/contact/isBlocked/:sessionId', sessionConnected, contactController.isBlocked);
router.post('/contact/getCommonGroups/:sessionId', sessionConnected, contactController.getCommonGroups);
router.post('/contact/getFormattedNumber/:sessionId', sessionConnected, contactController.getFormattedNumber);
router.post('/contact/getCountryCode/:sessionId', sessionConnected, contactController.getCountryCode);

// ============================================================================
// Group Chat Operations
// ============================================================================
router.post('/groupChat/getGroupInfo/:sessionId', sessionConnected, groupChatController.getGroupInfo);
router.post('/groupChat/getParticipants/:sessionId', sessionConnected, groupChatController.getParticipants);
router.post('/groupChat/addParticipants/:sessionId', sessionConnected, groupChatController.addParticipants);
router.post('/groupChat/removeParticipants/:sessionId', sessionConnected, groupChatController.removeParticipants);
router.post('/groupChat/promoteParticipants/:sessionId', sessionConnected, groupChatController.promoteParticipants);
router.post('/groupChat/demoteParticipants/:sessionId', sessionConnected, groupChatController.demoteParticipants);
router.post('/groupChat/setSubject/:sessionId', sessionConnected, groupChatController.setSubject);
router.post('/groupChat/setDescription/:sessionId', sessionConnected, groupChatController.setDescription);
router.post('/groupChat/setMessagesAdminsOnly/:sessionId', sessionConnected, groupChatController.setMessagesAdminsOnly);
router.post('/groupChat/setInfoAdminsOnly/:sessionId', sessionConnected, groupChatController.setInfoAdminsOnly);
router.post('/groupChat/leave/:sessionId', sessionConnected, groupChatController.leave);
router.post('/groupChat/getInviteCode/:sessionId', sessionConnected, groupChatController.getInviteCode);
router.post('/groupChat/revokeInvite/:sessionId', sessionConnected, groupChatController.revokeInvite);
router.post('/groupChat/acceptInvite/:sessionId', sessionConnected, groupChatController.acceptInvite);
router.post('/groupChat/getInviteInfo/:sessionId', sessionConnected, groupChatController.getInviteInfo);
router.post('/groupChat/setPicture/:sessionId', sessionConnected, groupChatController.setPicture);
router.post('/groupChat/deletePicture/:sessionId', sessionConnected, groupChatController.deletePicture);

// ============================================================================
// Message Operations
// ============================================================================
router.post('/message/getInfo/:sessionId', sessionConnected, messageController.getInfo);
router.post('/message/react/:sessionId', sessionConnected, messageController.react);
router.post('/message/star/:sessionId', sessionConnected, messageController.star);
router.post('/message/delete/:sessionId', sessionConnected, messageController.deleteMessage);
router.post('/message/forward/:sessionId', sessionConnected, messageController.forward);
router.post('/message/downloadMedia/:sessionId', sessionConnected, messageController.downloadMedia);
router.post('/message/getQuotedMessage/:sessionId', sessionConnected, messageController.getQuotedMessage);
router.post('/message/getMentions/:sessionId', sessionConnected, messageController.getMentions);
router.post('/message/edit/:sessionId', sessionConnected, messageController.edit);
router.post('/message/pin/:sessionId', sessionConnected, messageController.pin);
router.post('/message/unpin/:sessionId', sessionConnected, messageController.unpin);

export default router;
