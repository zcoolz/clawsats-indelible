/**
 * Dispute Resolution & Escrow
 *
 * Agents can lock funds in escrow before work begins. Funds release
 * on proof of completion (preimage reveal) or refund after timeout.
 * If disputed, a third-party arbitrator can decide.
 *
 * Uses @bsv/sdk Transaction, P2PKH, and Hash for escrow scripting.
 */

import { PrivateKey, Hash, Utils, SignedMessage } from '@bsv/sdk'

/**
 * Create an escrow agreement — both parties sign before funds lock
 *
 * The escrow defines: who pays, who works, how much, what work,
 * and what the completion proof looks like (hash of a preimage).
 *
 * @param {object} config
 * @param {string} config.payerWif - Payer's private key
 * @param {string} config.payeePubKey - Worker's public key
 * @param {number} config.amount - Satoshis to lock in escrow
 * @param {string} config.description - What work is expected
 * @param {string} config.preimage - Secret that proves work completion (payer generates, shares with payee on completion)
 * @param {number} [config.timeoutHours=72] - Hours before payer can reclaim funds
 * @returns {object} { escrow, conditionHash, signature }
 */
export function createEscrow(config) {
  const { payerWif, payeePubKey, amount, description, preimage, timeoutHours = 72 } = config

  if (!payerWif) throw new Error('payerWif required')
  if (!payeePubKey) throw new Error('payeePubKey required')
  if (!amount || amount < 1) throw new Error('amount must be positive')
  if (!description) throw new Error('description required')
  if (!preimage) throw new Error('preimage required')

  const payerKey = PrivateKey.fromWif(payerWif)
  const conditionHash = Utils.toHex(Hash.sha256(Utils.toArray(preimage, 'utf8')))
  const createdAt = new Date().toISOString()
  const expiresAt = new Date(Date.now() + timeoutHours * 60 * 60 * 1000).toISOString()

  const escrow = {
    payerPubKey: payerKey.toPublicKey().toString(),
    payeePubKey,
    amount,
    description,
    conditionHash,
    timeoutHours,
    createdAt,
    expiresAt,
    status: 'pending'
  }

  // Sign the escrow terms
  const message = JSON.stringify(escrow)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sig = SignedMessage.sign(messageBytes, payerKey)

  return {
    escrow,
    conditionHash,
    signature: Utils.toHex(sig)
  }
}

/**
 * Accept an escrow agreement — worker signs to confirm they agree to terms
 *
 * @param {object} config
 * @param {string} config.payeeWif - Worker's private key
 * @param {object} config.escrow - Escrow object from createEscrow
 * @param {string} config.payerSignature - Payer's signature hex from createEscrow
 * @returns {object} { accepted: true, escrow, payeeSignature }
 */
export function acceptEscrow(config) {
  const { payeeWif, escrow, payerSignature } = config

  if (!payeeWif) throw new Error('payeeWif required')
  if (!escrow) throw new Error('escrow required')
  if (!payerSignature) throw new Error('payerSignature required')

  // Verify payer's signature
  const message = JSON.stringify(escrow)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sigBytes = Utils.toArray(payerSignature, 'hex')
  const payerValid = SignedMessage.verify(messageBytes, sigBytes)

  if (!payerValid) throw new Error('Invalid payer signature')

  const payeeKey = PrivateKey.fromWif(payeeWif)
  if (payeeKey.toPublicKey().toString() !== escrow.payeePubKey) {
    throw new Error('payeeWif does not match escrow payeePubKey')
  }

  // Worker signs acceptance
  const acceptMessage = JSON.stringify({ ...escrow, status: 'accepted' })
  const acceptBytes = Utils.toArray(acceptMessage, 'utf8')
  const payeeSig = SignedMessage.sign(acceptBytes, payeeKey)

  return {
    accepted: true,
    escrow: { ...escrow, status: 'accepted' },
    payeeSignature: Utils.toHex(payeeSig)
  }
}

/**
 * Release escrow — worker proves completion by revealing the preimage
 *
 * @param {object} config
 * @param {string} config.preimage - The secret preimage that hashes to conditionHash
 * @param {object} config.escrow - The escrow object
 * @returns {object} { released: true, preimage, conditionHash }
 */
export function releaseEscrow(config) {
  const { preimage, escrow } = config

  if (!preimage) throw new Error('preimage required')
  if (!escrow) throw new Error('escrow required')

  const hash = Utils.toHex(Hash.sha256(Utils.toArray(preimage, 'utf8')))

  if (hash !== escrow.conditionHash) {
    throw new Error('Preimage does not match condition hash — release denied')
  }

  return {
    released: true,
    preimage,
    conditionHash: escrow.conditionHash,
    amount: escrow.amount,
    payeePubKey: escrow.payeePubKey,
    releasedAt: new Date().toISOString()
  }
}

/**
 * Refund escrow — payer reclaims after timeout expires
 *
 * @param {object} config
 * @param {string} config.payerWif - Payer's private key
 * @param {object} config.escrow - The escrow object
 * @returns {object} { refunded: true, reason }
 */
export function refundEscrow(config) {
  const { payerWif, escrow } = config

  if (!payerWif) throw new Error('payerWif required')
  if (!escrow) throw new Error('escrow required')

  const payerKey = PrivateKey.fromWif(payerWif)
  if (payerKey.toPublicKey().toString() !== escrow.payerPubKey) {
    throw new Error('payerWif does not match escrow payerPubKey')
  }

  const now = new Date()
  const expires = new Date(escrow.expiresAt)

  if (now < expires) {
    throw new Error(`Escrow has not expired yet — expires at ${escrow.expiresAt}`)
  }

  return {
    refunded: true,
    amount: escrow.amount,
    payerPubKey: escrow.payerPubKey,
    reason: 'Timeout expired without work completion',
    refundedAt: new Date().toISOString()
  }
}

/**
 * Create a dispute — escalate to a third-party arbitrator
 *
 * Either party can raise a dispute. The arbitrator receives the escrow
 * details, both signatures, and the dispute reason, then decides.
 *
 * @param {object} config
 * @param {string} config.disputerWif - Disputer's private key (payer or payee)
 * @param {object} config.escrow - The escrow object
 * @param {string} config.reason - Why the dispute is being raised
 * @param {string} config.arbitratorPubKey - Arbitrator's public key
 * @param {string[]} [config.evidence] - Optional evidence strings
 * @returns {object} { dispute, signature }
 */
export function createDispute(config) {
  const { disputerWif, escrow, reason, arbitratorPubKey, evidence = [] } = config

  if (!disputerWif) throw new Error('disputerWif required')
  if (!escrow) throw new Error('escrow required')
  if (!reason) throw new Error('reason required')
  if (!arbitratorPubKey) throw new Error('arbitratorPubKey required')

  const disputerKey = PrivateKey.fromWif(disputerWif)
  const disputerPubKey = disputerKey.toPublicKey().toString()

  // Verify disputer is either payer or payee
  if (disputerPubKey !== escrow.payerPubKey && disputerPubKey !== escrow.payeePubKey) {
    throw new Error('Disputer must be either payer or payee')
  }

  const dispute = {
    escrowConditionHash: escrow.conditionHash,
    disputerPubKey,
    disputerRole: disputerPubKey === escrow.payerPubKey ? 'payer' : 'payee',
    arbitratorPubKey,
    reason,
    evidence,
    createdAt: new Date().toISOString(),
    status: 'open'
  }

  const message = JSON.stringify(dispute)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sig = SignedMessage.sign(messageBytes, disputerKey)

  return {
    dispute,
    signature: Utils.toHex(sig)
  }
}

/**
 * Resolve a dispute — arbitrator decides who gets the funds
 *
 * @param {object} config
 * @param {string} config.arbitratorWif - Arbitrator's private key
 * @param {object} config.dispute - The dispute object
 * @param {object} config.escrow - The original escrow
 * @param {string} config.decision - 'payer' or 'payee' — who wins
 * @param {string} config.reasoning - Arbitrator's explanation
 * @returns {object} { resolution, signature }
 */
export function resolveDispute(config) {
  const { arbitratorWif, dispute, escrow, decision, reasoning } = config

  if (!arbitratorWif) throw new Error('arbitratorWif required')
  if (!dispute) throw new Error('dispute required')
  if (!escrow) throw new Error('escrow required')
  if (!decision || !['payer', 'payee'].includes(decision)) {
    throw new Error('decision must be "payer" or "payee"')
  }
  if (!reasoning) throw new Error('reasoning required')

  const arbitratorKey = PrivateKey.fromWif(arbitratorWif)
  if (arbitratorKey.toPublicKey().toString() !== dispute.arbitratorPubKey) {
    throw new Error('arbitratorWif does not match dispute arbitratorPubKey')
  }

  const winner = decision === 'payer' ? escrow.payerPubKey : escrow.payeePubKey

  const resolution = {
    escrowConditionHash: escrow.conditionHash,
    disputeCreatedAt: dispute.createdAt,
    decision,
    winner,
    amount: escrow.amount,
    reasoning,
    resolvedAt: new Date().toISOString(),
    status: 'resolved'
  }

  const message = JSON.stringify(resolution)
  const messageBytes = Utils.toArray(message, 'utf8')
  const sig = SignedMessage.sign(messageBytes, arbitratorKey)

  return {
    resolution,
    signature: Utils.toHex(sig)
  }
}
