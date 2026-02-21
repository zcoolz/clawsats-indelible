/**
 * Encrypted Messages (BRC-78)
 *
 * Agent-to-agent private communication. Two agents can exchange
 * encrypted data that only the intended recipient can decrypt.
 * Different from per-agent AES storage encryption — this is for
 * direct agent-to-agent messaging.
 *
 * Uses EncryptedMessage from @bsv/sdk which implements BRC-78.
 */

import { EncryptedMessage, PrivateKey, PublicKey, Utils } from '@bsv/sdk'

/**
 * Encrypt a message from one agent to another
 *
 * @param {object} config
 * @param {string} config.senderWif - Sender's private key (WIF)
 * @param {string} config.recipientPubKey - Recipient's public key (hex, compressed)
 * @param {string|object} config.message - Message to encrypt (string or object → JSON)
 * @returns {string} Encrypted message as hex
 */
export function encryptMessage(config) {
  const { senderWif, recipientPubKey, message } = config

  if (!senderWif) throw new Error('senderWif required')
  if (!recipientPubKey) throw new Error('recipientPubKey required')
  if (message === undefined || message === null) throw new Error('message required')

  const senderKey = PrivateKey.fromWif(senderWif)
  const recipientKey = PublicKey.fromString(recipientPubKey)

  const text = typeof message === 'string' ? message : JSON.stringify(message)
  const messageBytes = Utils.toArray(text, 'utf8')

  const encrypted = EncryptedMessage.encrypt(messageBytes, senderKey, recipientKey)
  return Utils.toHex(encrypted)
}

/**
 * Decrypt a message received from another agent
 *
 * @param {object} config
 * @param {string} config.recipientWif - Recipient's private key (WIF)
 * @param {string} config.encryptedHex - Encrypted message hex from encryptMessage
 * @param {boolean} config.parseJson - If true, parse the decrypted text as JSON (default: false)
 * @returns {string|object} Decrypted message
 */
export function decryptMessage(config) {
  const { recipientWif, encryptedHex, parseJson = false } = config

  if (!recipientWif) throw new Error('recipientWif required')
  if (!encryptedHex) throw new Error('encryptedHex required')

  const recipientKey = PrivateKey.fromWif(recipientWif)
  const encryptedBytes = Utils.toArray(encryptedHex, 'hex')

  const decrypted = EncryptedMessage.decrypt(encryptedBytes, recipientKey)
  const text = Utils.toUTF8(decrypted)

  return parseJson ? JSON.parse(text) : text
}
