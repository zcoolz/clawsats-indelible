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

/** ClawSats protocol fee: 2 sats per paid call */
const CLAWSATS_PROTOCOL_FEE = 2

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
 * @param {boolean} [config.requireProtocolFee=false] - If true, verify ClawSats 2-sat protocol fee output
 * @param {string} [config.feeAddress] - Address for protocol fee output (required if requireProtocolFee=true)
 * @returns {function} Express middleware
 */
export function createIndeliblePaymentMiddleware(config) {
  const {
    operatorAddress,
    calculatePrice,
    wallet = null,
    requireProtocolFee = false,
    feeAddress = null
  } = config
  const usedPrefixes = new Set()

  if (!operatorAddress) throw new Error('operatorAddress required')
  if (!calculatePrice) throw new Error('calculatePrice function required')
  if (requireProtocolFee && !feeAddress) throw new Error('feeAddress required when requireProtocolFee is true')

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

      // Include fee info if protocol fee is required
      if (requireProtocolFee) {
        res.set('x-clawsats-fee-required', 'true')
        res.set('x-clawsats-fee-sats', String(CLAWSATS_PROTOCOL_FEE))
        res.set('x-clawsats-fee-address', feeAddress)
      }

      return res.status(402).json({
        status: 'error',
        code: 'ERR_PAYMENT_REQUIRED',
        satoshisRequired: price,
        operatorAddress,
        ...(requireProtocolFee ? {
          protocolFee: CLAWSATS_PROTOCOL_FEE,
          feeAddress
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
            outputs: tx.outputs.map((output, i) => ({
              outputIndex: i,
              protocol: 'wallet payment',
              paymentRemittance: {
                derivationPrefix,
                derivationSuffix: derivationSuffix || 'clawsats',
                senderIdentityKey: req.headers['x-bsv-identity-key'] || ''
              }
            })),
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

      // Verify protocol fee output if required
      if (requireProtocolFee) {
        const feeScript = p2pkh.lock(feeAddress).toHex()
        let feePaid = 0
        for (const output of tx.outputs) {
          if (output.lockingScript.toHex() === feeScript) {
            feePaid += output.satoshis
          }
        }
        if (feePaid < CLAWSATS_PROTOCOL_FEE) {
          return res.status(400).json({
            error: `Protocol fee missing: ${feePaid} sats fee paid, ${CLAWSATS_PROTOCOL_FEE} required`,
            feePaid,
            feeRequired: CLAWSATS_PROTOCOL_FEE
          })
        }
        req.protocolFee = { feePaid, feeAddress }
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
