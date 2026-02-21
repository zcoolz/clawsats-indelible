/**
 * Inter-Agent Communication Standard
 *
 * Standardized agent-to-agent messaging protocol. Agents establish
 * authenticated channels, send signed+encrypted messages, and broadcast
 * their capabilities for discovery.
 *
 * Builds on BRC-31 (Authrite), BRC-77 (signing), BRC-78 (encryption),
 * and SHIP/SLAP (discovery) to create a unified messaging layer.
 */

import { PrivateKey, PublicKey, SignedMessage, EncryptedMessage, Utils } from '@bsv/sdk'

/**
 * Create a messaging channel between two agents
 *
 * A channel holds the cryptographic context for ongoing communication.
 * Messages sent through a channel are automatically signed by the sender
 * and encrypted for the recipient.
 *
 * @param {object} config
 * @param {string} config.senderWif - Sender's private key (WIF)
 * @param {string} config.recipientPubKey - Recipient's public key (hex)
 * @param {string} [config.channelName] - Optional human-readable channel name
 * @returns {object} Channel object with send/receive methods
 */
export function createChannel(config) {
  const { senderWif, recipientPubKey, channelName = '' } = config

  if (!senderWif) throw new Error('senderWif required')
  if (!recipientPubKey) throw new Error('recipientPubKey required')

  const senderKey = PrivateKey.fromWif(senderWif)
  const senderPubKey = senderKey.toPublicKey().toString()
  const createdAt = new Date().toISOString()

  return {
    senderPubKey,
    recipientPubKey,
    channelName,
    createdAt,

    /**
     * Send a message through this channel
     *
     * @param {string} action - Message type (e.g. 'context_handoff', 'task_request')
     * @param {object} payload - Message payload
     * @returns {object} { envelope, encrypted }
     */
    send(action, payload) {
      return sendMessage({
        senderWif,
        recipientPubKey,
        action,
        payload
      })
    },

    /**
     * Receive and decrypt a message on this channel
     *
     * NOTE: The recipientWif must be the RECIPIENT's private key, not the sender's.
     * The sender creates the channel, but only the recipient can decrypt messages
     * sent through it.
     *
     * @param {string} recipientWif - Recipient's private key (WIF) — must be the recipient, not sender
     * @param {string} encryptedHex - Encrypted envelope hex
     * @returns {object} Decrypted and verified message
     */
    receive(recipientWif, encryptedHex) {
      if (!recipientWif) throw new Error('recipientWif required — must be the recipient\'s key, not the sender\'s')
      return receiveMessage({
        recipientWif,
        encryptedHex
      })
    }
  }
}

/**
 * Send a signed and encrypted message to another agent
 *
 * The message is:
 * 1. Wrapped in a standard envelope (action, timestamp, sender)
 * 2. Signed with BRC-77 (proves sender identity)
 * 3. Encrypted with BRC-78 (only recipient can read)
 *
 * @param {object} config
 * @param {string} config.senderWif - Sender's private key
 * @param {string} config.recipientPubKey - Recipient's public key
 * @param {string} config.action - Message type
 * @param {object} config.payload - Message data
 * @returns {object} { envelope, encrypted (hex), signature (hex) }
 */
export function sendMessage(config) {
  const { senderWif, recipientPubKey, action, payload } = config

  if (!senderWif) throw new Error('senderWif required')
  if (!recipientPubKey) throw new Error('recipientPubKey required')
  if (!action) throw new Error('action required')

  const senderKey = PrivateKey.fromWif(senderWif)

  // Build standard envelope
  const envelope = {
    protocol: 'indelible-agent-msg-v1',
    action,
    sender: senderKey.toPublicKey().toString(),
    recipient: recipientPubKey,
    timestamp: new Date().toISOString(),
    payload: payload || {}
  }

  // Sign the envelope (BRC-77)
  const envelopeJson = JSON.stringify(envelope)
  const envelopeBytes = Utils.toArray(envelopeJson, 'utf8')
  const sig = SignedMessage.sign(envelopeBytes, senderKey)

  // Wrap envelope + signature for encryption
  const signedEnvelope = {
    envelope,
    signature: Utils.toHex(sig)
  }

  // Encrypt for recipient (BRC-78)
  const plaintext = Utils.toArray(JSON.stringify(signedEnvelope), 'utf8')
  const recipientKeyObj = PublicKey.fromString(recipientPubKey)
  const encrypted = EncryptedMessage.encrypt(plaintext, senderKey, recipientKeyObj)

  return {
    envelope,
    encrypted: Utils.toHex(encrypted),
    signature: Utils.toHex(sig)
  }
}

/**
 * Receive and decrypt a message from another agent
 *
 * Decrypts the message, verifies the sender's signature, and returns
 * the original envelope with verification status.
 *
 * @param {object} config
 * @param {string} config.recipientWif - Recipient's private key
 * @param {string} config.encryptedHex - Encrypted message hex
 * @returns {object} { verified, envelope, signature }
 */
export function receiveMessage(config) {
  const { recipientWif, encryptedHex } = config

  if (!recipientWif) throw new Error('recipientWif required')
  if (!encryptedHex) throw new Error('encryptedHex required')

  const recipientKey = PrivateKey.fromWif(recipientWif)
  const encryptedBytes = Utils.toArray(encryptedHex, 'hex')

  // Decrypt (BRC-78)
  const decrypted = EncryptedMessage.decrypt(encryptedBytes, recipientKey)
  const signedEnvelope = JSON.parse(Utils.toUTF8(decrypted))

  const { envelope, signature } = signedEnvelope

  // Verify sender's signature (BRC-77)
  const envelopeJson = JSON.stringify(envelope)
  const envelopeBytes = Utils.toArray(envelopeJson, 'utf8')
  const sigBytes = Utils.toArray(signature, 'hex')
  const verified = SignedMessage.verify(envelopeBytes, sigBytes)

  return {
    verified,
    envelope,
    signature
  }
}

/**
 * Create a capability announcement for service discovery
 *
 * Agents broadcast what actions they support so other agents can find them.
 * Uses a standard format compatible with SHIP/SLAP.
 *
 * @param {object} config
 * @param {string} config.agentWif - Agent's private key
 * @param {string[]} config.capabilities - Actions this agent supports
 * @param {string} [config.endpoint] - URL where this agent can be reached
 * @param {object} [config.metadata] - Additional metadata (version, pricing, etc.)
 * @returns {object} { announcement, signature }
 */
export function createCapabilityAnnouncement(config) {
  const { agentWif, capabilities, endpoint = '', metadata = {} } = config

  if (!agentWif) throw new Error('agentWif required')
  if (!capabilities || !capabilities.length) throw new Error('capabilities required')

  const agentKey = PrivateKey.fromWif(agentWif)

  const announcement = {
    protocol: 'indelible-agent-cap-v1',
    agentPubKey: agentKey.toPublicKey().toString(),
    capabilities,
    endpoint,
    metadata,
    announcedAt: new Date().toISOString()
  }

  const message = JSON.stringify(announcement)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sig = SignedMessage.sign(messageBytes, agentKey)

  return {
    announcement,
    signature: Utils.toHex(sig)
  }
}

/**
 * Verify a capability announcement from another agent
 *
 * @param {object} config
 * @param {object} config.announcement - The announcement object
 * @param {string} config.signature - Signature hex
 * @returns {boolean} true if the announcement is valid
 */
export function verifyCapabilityAnnouncement(config) {
  const { announcement, signature } = config

  if (!announcement) throw new Error('announcement required')
  if (!signature) throw new Error('signature required')

  const message = JSON.stringify(announcement)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sigBytes = Utils.toArray(signature, 'hex')

  return SignedMessage.verify(messageBytes, sigBytes)
}
