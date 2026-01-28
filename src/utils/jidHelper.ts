/**
 * JID Helper utilities for converting between wwebjs and Baileys JID formats
 *
 * wwebjs uses: 1234567890@c.us (contacts), 1234567890-1234567890@g.us (groups)
 * Baileys uses: 1234567890@s.whatsapp.net (contacts), 1234567890@g.us (groups)
 */

/**
 * Convert wwebjs JID format to Baileys JID format
 */
export function toBaileysJid(id: string): string {
  if (!id) return id;

  // Handle group JIDs (already correct format)
  if (id.endsWith('@g.us')) {
    return id;
  }

  // Handle broadcast lists
  if (id.endsWith('@broadcast')) {
    return id;
  }

  // Handle status broadcast
  if (id === 'status@broadcast') {
    return id;
  }

  // Convert contact JID from @c.us to @s.whatsapp.net
  if (id.endsWith('@c.us')) {
    return id.replace('@c.us', '@s.whatsapp.net');
  }

  // If already in Baileys format, return as-is
  if (id.endsWith('@s.whatsapp.net')) {
    return id;
  }

  // If just a phone number, add the suffix
  if (/^\d+$/.test(id)) {
    return `${id}@s.whatsapp.net`;
  }

  return id;
}

/**
 * Convert Baileys JID format to wwebjs JID format
 */
export function toWwebjsJid(id: string): string {
  if (!id) return id;

  // Handle group JIDs (already correct format)
  if (id.endsWith('@g.us')) {
    return id;
  }

  // Handle broadcast lists
  if (id.endsWith('@broadcast')) {
    return id;
  }

  // Convert contact JID from @s.whatsapp.net to @c.us
  if (id.endsWith('@s.whatsapp.net')) {
    return id.replace('@s.whatsapp.net', '@c.us');
  }

  // If already in wwebjs format, return as-is
  if (id.endsWith('@c.us')) {
    return id;
  }

  // If just a phone number, add the suffix
  if (/^\d+$/.test(id)) {
    return `${id}@c.us`;
  }

  return id;
}

/**
 * Extract phone number from JID
 */
export function getPhoneNumber(jid: string): string {
  if (!jid) return '';
  return jid.split('@')[0];
}

/**
 * Check if JID is a group
 */
export function isGroupJid(jid: string): boolean {
  return jid?.endsWith('@g.us') ?? false;
}

/**
 * Check if JID is a broadcast list
 */
export function isBroadcastJid(jid: string): boolean {
  return jid?.endsWith('@broadcast') ?? false;
}

/**
 * Check if JID is status broadcast
 */
export function isStatusBroadcast(jid: string): boolean {
  return jid === 'status@broadcast';
}

/**
 * Create a serialized ID object matching wwebjs format
 */
export function createSerializedId(jid: string): { _serialized: string; user: string; server: string } {
  const wwebjsJid = toWwebjsJid(jid);
  const [user, server] = wwebjsJid.split('@');
  return {
    _serialized: wwebjsJid,
    user: user || '',
    server: server || '',
  };
}

/**
 * Create a message ID object matching wwebjs format
 */
export function createMessageId(
  id: string,
  remote: string,
  fromMe: boolean
): { _serialized: string; fromMe: boolean; remote: string; id: string } {
  const wwebjsRemote = toWwebjsJid(remote);
  return {
    _serialized: `${fromMe}_${wwebjsRemote}_${id}`,
    fromMe,
    remote: wwebjsRemote,
    id,
  };
}
