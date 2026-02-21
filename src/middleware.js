/**
 * BRC-105 Payment Middleware (v2 — Real Verification)
 *
 * Implements the HTTP 402 Payment Required flow for Indelible capabilities.
 * When a request comes in without payment, returns 402 with required headers.
 * When payment is included, parses the raw transaction and verifies an output
 * pays the operator address the required amount.
 */

import crypto from 'crypto'
import { Transaction, P2PKH } from '@bsv/sdk'

/**
 * Create Express middleware for BRC-105 payment gating
 *
 * @param {object} config
 * @param {string} config.operatorAddress - BSV address to receive payments
 * @param {function} config.calculatePrice - (req) => sats required
 * @returns {function} Express middleware
 */
export function createIndeliblePaymentMiddleware(config) {
  const { operatorAddress, calculatePrice } = config
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

      return res.status(402).json({
        status: 'error',
        code: 'ERR_PAYMENT_REQUIRED',
        satoshisRequired: price,
        operatorAddress,
        description: `Pay ${price} sats to use Indelible memory service`
      })
    }

    // Payment included: verify
    try {
      const payment = JSON.parse(paymentHeader)
      const { derivationPrefix, transaction } = payment

      // Replay protection
      if (usedPrefixes.has(derivationPrefix)) {
        return res.status(400).json({ error: 'Payment prefix already used (replay detected)' })
      }

      // BRC-105 v2: Parse raw transaction and verify payment output
      if (!transaction || typeof transaction !== 'string') {
        return res.status(400).json({ error: 'Invalid payment transaction' })
      }

      // Parse the transaction hex
      let tx
      try {
        tx = Transaction.fromHex(transaction)
      } catch (parseErr) {
        return res.status(400).json({ error: `Invalid transaction hex: ${parseErr.message}` })
      }

      // Build expected locking script for operator address
      const p2pkh = new P2PKH()
      const expectedScript = p2pkh.lock(operatorAddress).toHex()

      // Find output(s) paying to operator address
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

      usedPrefixes.add(derivationPrefix)

      // Clean up old prefixes (memory management)
      if (usedPrefixes.size > 10000) {
        const iterator = usedPrefixes.values()
        for (let i = 0; i < 5000; i++) {
          usedPrefixes.delete(iterator.next().value)
        }
      }

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
