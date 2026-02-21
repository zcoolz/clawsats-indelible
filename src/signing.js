/**
 * Signed Messages (BRC-77)
 *
 * Agents cryptographically sign their actions (saves, loads, requests).
 * Anyone can verify "agent X really did this" — not spoofable.
 *
 * Uses SignedMessage from @bsv/sdk which implements BRC-77.
 */

import { SignedMessage, PrivateKey, Utils } from '@bsv/sdk'

/**
 * Sign an agent action
 *
 * @param {object} config
 * @param {string} config.privateKeyWif - Agent's private key (WIF)
 * @param {string} config.action - Action name (e.g. 'save_context', 'load_context')
 * @param {object} config.payload - Action payload to sign
 * @returns {object} { signature: string (hex), publicKey: string, action, timestamp }
 */
export function signAction(config) {
  const { privateKeyWif, action, payload } = config

  if (!privateKeyWif) throw new Error('privateKeyWif required')
  if (!action) throw new Error('action required')

  const key = PrivateKey.fromWif(privateKeyWif)
  const timestamp = new Date().toISOString()

  // Build canonical message: action + timestamp + sorted payload JSON
  const message = JSON.stringify({ action, timestamp, payload })
  const messageBytes = Utils.toArray(message, 'utf8')

  const sig = SignedMessage.sign(messageBytes, key)

  return {
    signature: Utils.toHex(sig),
    publicKey: key.toPublicKey().toString(),
    action,
    timestamp
  }
}

/**
 * Verify a signed agent action
 *
 * @param {object} config
 * @param {string} config.signature - Signature hex from signAction
 * @param {string} config.action - Action name
 * @param {string} config.timestamp - ISO timestamp from signAction
 * @param {object} config.payload - Original payload
 * @returns {boolean} true if signature is valid
 */
export function verifyAction(config) {
  const { signature, action, timestamp, payload } = config

  if (!signature) throw new Error('signature required')
  if (!action) throw new Error('action required')

  const message = JSON.stringify({ action, timestamp, payload })
  const messageBytes = Utils.toArray(message, 'utf8')
  const sigBytes = Utils.toArray(signature, 'hex')

  return SignedMessage.verify(messageBytes, sigBytes)
}
