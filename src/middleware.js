/**
 * BRC-105 Payment Middleware (v3 — ClawSats Compatible)
 *
 * Implements the HTTP 402 Payment Required flow for Indelible capabilities.
 * When a request comes in without payment, returns 402 with required headers.
 * When payment is included, parses the transaction and verifies payment.
 *
 * Supports:
 * - Raw hex transactions (legacy)
 * - Base64-encoded transactions (ClawSats AuthFetch format)
 * - AtomicBEEF / BEEF format (BRC-62/BRC-95)
 * - Wallet internalization mode (BRC-29 via config.wallet)
 * - ClawSats protocol fee verification (x-clawsats-fee-* headers)
 */

import crypto from 'crypto'
import { Transaction, P2PKH, Utils } from '@bsv/sdk'

/** ClawSats protocol fee constants — canonical values from ClawSats protocol */
const FEE_SATS = 2
const FEE_KID = 'clawsats-fee-v1'
const FEE_DERIVATION_SUFFIX = 'fee'
const FEE_IDENTITY_KEY = '0307102dc99293edba7f75bf881712652879c151b454ebf5d8e7a0ba07c4d17364'

/**
 * Parse a transaction string in any supported format:
 * - Hex string (raw transaction)
 * - Base64 string (ClawSats AuthFetch sends this)
 * - Base64-encoded BEEF/AtomicBEEF (BRC-62/BRC-95)
 *
 * @param {string} txString - Transaction in hex or base64
 * @returns {Transaction} Parsed transaction
 */
function parseTransaction(txString) {
  // Try hex first (most common legacy format)
  if (/^[0-9a-fA-F]+$/.test(txString)) {
    return Transaction.fromHex(txString)
  }

  // Decode base64 to binary
  const binary = Utils.toArray(txString, 'base64')

  // Check for BEEF/AtomicBEEF magic bytes
  // BEEF starts with version 0x0100BEEF, AtomicBEEF with 0x01010101
  if (binary.length > 4) {
    const magic = (binary[0] << 24) | (binary[1] << 16) | (binary[2] << 8) | binary[3]
    if (magic === 0x0100BEEF) {
      return Transaction.fromBEEF(binary)
    }
    if (magic === 0x01010101) {
      return Transaction.fromAtomicBEEF(binary)
    }
  }

  // Plain base64-encoded raw transaction bytes
  const hex = Utils.toHex(binary)
  return Transaction.fromHex(hex)
}

/**
 * Create Express middleware for BRC-105 payment gating
 *
 * @param {object} config
 * @param {string} config.operatorAddress - BSV address to receive payments
 * @param {function} config.calculatePrice - (req) => sats required
 * @param {object} [config.wallet] - Optional BRC-29 wallet for internalizeAction verification
 * @param {boolean} [config.requireProtocolFee=false] - If true, verify ClawSats 2-sat protocol fee output exists
 * @returns {function} Express middleware
 */
export function createIndeliblePaymentMiddleware(config) {
  const {
    operatorAddress,
    calculatePrice,
    wallet = null,
    requireProtocolFee = false
  } = config
  const usedPrefixes = new Set()

  if (!operatorAddress) throw new Error('operatorAddress required')
  if (!calculatePrice) throw new Error('calculatePrice function required')

  return async (req, res, next) => {
    const price = await calculatePrice(req)

    // Free calls pass through
    if (price === 0) {
      req.payment = { satoshisPaid: 0, accepted: true }
      return next()
    }

    const paymentHeader = req.headers['x-bsv-payment']

    // No payment: return 402 challenge
    if (!paymentHeader) {
      const prefix = crypto.randomBytes(16).toString('base64')

      res.set('x-bsv-payment-version', '1.0')
      res.set('x-bsv-payment-satoshis-required', String(price))
      res.set('x-bsv-payment-derivation-prefix', prefix)
      res.set('x-bsv-payment-address', operatorAddress)

      // ClawSats protocol fee headers (exact names from WalletManager.ts)
      if (requireProtocolFee) {
        res.set('x-clawsats-fee-satoshis-required', String(FEE_SATS))
        res.set('x-clawsats-fee-kid', FEE_KID)
        res.set('x-clawsats-fee-derivation-suffix', FEE_DERIVATION_SUFFIX)
        res.set('x-clawsats-fee-identity-key', FEE_IDENTITY_KEY)
      }

      return res.status(402).json({
        status: 'error',
        code: 'ERR_PAYMENT_REQUIRED',
        satoshisRequired: price,
        operatorAddress,
        ...(requireProtocolFee ? {
          protocolFee: FEE_SATS,
          feeIdentityKey: FEE_IDENTITY_KEY
        } : {}),
        description: `Pay ${price} sats to use Indelible memory service`
      })
    }

    // Payment included: verify
    try {
      const payment = JSON.parse(paymentHeader)
      const { derivationPrefix, derivationSuffix, transaction } = payment

      // Replay protection
      if (usedPrefixes.has(derivationPrefix)) {
        return res.status(400).json({ error: 'Payment prefix already used (replay detected)' })
      }

      if (!transaction || typeof transaction !== 'string') {
        return res.status(400).json({ error: 'Invalid payment transaction' })
      }

      // Parse transaction — supports hex, base64, BEEF, and AtomicBEEF
      let tx
      try {
        tx = parseTransaction(transaction)
      } catch (parseErr) {
        return res.status(400).json({ error: `Invalid transaction: ${parseErr.message}` })
      }

      // --- Verification Mode ---

      if (wallet && typeof wallet.internalizeAction === 'function') {
        // BRC-29 mode: use wallet.internalizeAction for proper key-derived verification
        try {
          const result = await wallet.internalizeAction({
            tx,
            outputs: [{
              outputIndex: 0,
              protocol: 'wallet payment',
              paymentRemittance: {
                derivationPrefix,
                derivationSuffix: derivationSuffix || 'clawsats',
                senderIdentityKey: req.headers['x-bsv-identity-key'] || ''
              }
            }],
            description: `Payment: ${price} sats`
          })

          usedPrefixes.add(derivationPrefix)
          cleanupPrefixes(usedPrefixes)

          req.payment = {
            satoshisPaid: price,
            accepted: true,
            derivationPrefix,
            txid: tx.id('hex'),
            internalized: true,
            result
          }

          return next()
        } catch (intErr) {
          return res.status(400).json({ error: `Wallet internalization failed: ${intErr.message}` })
        }
      }

      // Static output-matching mode (legacy)
      const p2pkh = new P2PKH()
      const expectedScript = p2pkh.lock(operatorAddress).toHex()

      let satoshisPaid = 0
      for (const output of tx.outputs) {
        if (output.lockingScript.toHex() === expectedScript) {
          satoshisPaid += output.satoshis
        }
      }

      if (satoshisPaid < price) {
        return res.status(400).json({
          error: `Insufficient payment: ${satoshisPaid} sats paid, ${price} required`,
          satoshisPaid,
          satoshisRequired: price
        })
      }

      // Verify protocol fee output structurally (any output beyond index 0 with >= FEE_SATS)
      // Provider can't internalize the fee (doesn't hold treasury key) — just verify it exists.
      // The fee wallet holder does full BRC-29 derivation verification when sweeping.
      if (requireProtocolFee) {
        let feeOutputFound = false
        for (let i = 1; i < tx.outputs.length; i++) {
          if (tx.outputs[i].satoshis >= FEE_SATS) {
            feeOutputFound = true
            break
          }
        }
        if (!feeOutputFound) {
          return res.status(402).json({
            status: 'error',
            code: 'ERR_MISSING_FEE',
            description: `Payment must include a ${FEE_SATS}-sat fee output to the ClawSats protocol. See x-clawsats-fee-identity-key header.`
          })
        }
      }

      usedPrefixes.add(derivationPrefix)
      cleanupPrefixes(usedPrefixes)

      req.payment = {
        satoshisPaid,
        accepted: true,
        derivationPrefix,
        txid: tx.id('hex')
      }

      next()
    } catch (err) {
      res.status(400).json({ error: `Payment verification failed: ${err.message}` })
    }
  }
}

/**
 * Clean up old derivation prefixes to prevent memory leaks
 * @param {Set} prefixSet
 */
function cleanupPrefixes(prefixSet) {
  if (prefixSet.size > 10000) {
    const iterator = prefixSet.values()
    for (let i = 0; i < 5000; i++) {
      prefixSet.delete(iterator.next().value)
    }
  }
}
